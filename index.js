const compressing = require('compressing');
const chalk = require('chalk');
const path = require('path');
const fs = require('fs-extra');
const { Client } = require('ssh2');
const spin = require('io-spin')
const execa = require("execa");
const slog = require("single-line-log").stdout;
// 土味儿英语 能将就这看
// yarn add single-line-log execa  io-spin ssh2 fs-extra compressing chalk
function Log(){
  this.log = console.log;
};

Log.prototype.blue = function(str){
  this.log(chalk.blue(str))
};

Log.prototype.yellow = function(str){
  this.log(chalk.yellow(str))
};

Log.prototype.red = function(str){
  this.log(chalk.red(str))
};

const log = new Log();

function Generator(option, userInputFn){
  this.option = option;
  this.dir = process.cwd();
  this.compressPath = "";
  this.userInputFn = userInputFn;
};

Generator.prototype.build = async function(){
  log.red('=>开始打包项目');
  await cmd('npm run build', { show: false, cwd: this.dir });
  log.red('=>打包完成');
};

Generator.prototype.compress = async function(){
  let spinner = spin(chalk.green('✨ 正在压缩打包后的项目...'), "Spin9");
  let { floder } = this.option;
  spinner.start();
  let source = path.resolve(this.dir, floder), compressedName = floder + '.zip';
  let compressPath = path.resolve(this.dir, compressedName);
  if(fs.existsSync(compressPath)){
    fs.removeSync(compressPath)
  }
  await compressing.zip.compressDir(source, compressedName);
  await wait(1000);
  this.compressPath = compressPath;
  spinner.stop();
  log.red('=>压缩完成');
};

Generator.prototype.testConnect = async function(){
  let spinner = spin(chalk.green('✨ 正在测试连接远程ssh...'), "Spin9");
  spinner.start();
  await wait(500);
  let { option } = this;
  return new Promise((resolve,reject)=>{
    const conn = new Client();
    conn.on('ready', () => {
      // log.blue("Client :: ready");
      spinner.stop();
      conn.exec('uptime', (err, stream) => {
        if (err) throw err;
        stream.on('close', (code, signal) => {
          if (code !== 0) {
            log.red('=>测试连接远程ssh失败');
            reject(new Error(`ssh 链接失败`))
            return
        }
          conn.end();
          log.red('=>远程ssh测试连接成功');
          resolve();
        }).on('data', (data) => {
          log.yellow('STDOUT: ' + data);
        }).stderr.on('data', (data) => {
          log.yellow('STDERR: ' + data);
        });
      });    
    }).connect({
      host: option.host,
      port: option.port,
      username: option.user,
      privateKey: option.sshKey
    });
  })
};

Generator.prototype.uploadFile = async function(){
  let { option, compressPath } = this;
  await cmd(`scp ${ compressPath} ${ option.user }@${ option.host }:${ option.uploadPath }`, { show: true });
  fs.removeSync(compressPath);
  log.red('=>上传完毕');
};

Generator.prototype.connectServer = async function(){
  let { option } = this;
  let spinner = spin(chalk.green('✨ 开始连接远程服务器...'), "Spin9");
  spinner.start();
  await wait(500);
  return new Promise((resolve,reject)=>{
    const conn = new Client();
    conn.on('ready', () => {
      log.blue("Client :: ready");
      spinner.stop();
      conn.shell((err, stream) => {
        if (err) throw err;
        stream.on('close', () => {
          log.blue("Stream :: close")
          conn.end();
          resolve();
        })
        .on('data', (data) => {
          log.yellow('OUTPUT: ' + data);
        });
        this.userInputFn(stream);
      });   
    }).connect({
      host: option.host,
      port: option.port,
      username: option.user,
      privateKey: option.sshKey
    });
  })
};

Generator.prototype.checkOption = function(){
  let option = this.option;
  if(!option || typeof option != 'object'){
    throw new Error('option param error');
  };
  if(!option.user || typeof option.user != 'string'){
    throw new Error('option.user param error');
  };
  if(!option.password || typeof option.password != 'string'){
    throw new Error('option.password param error');
  };
  if(!option.sshKey || typeof option.sshKey != 'string'){
    throw new Error('option.sshKey param error');
  };
  if(!option.host || typeof option.host != 'string'){
    throw new Error('option.host param error');
  };
  this.option.port = option.port || 22;
  this.option.floder = option.floder || "dist";
};

Generator.prototype.start = async function(){
  this.checkOption();
  await this.testConnect(); // 测试链接
  await this.build(); // 打包项目
  await this.compress(); // 压缩文件
  await this.uploadFile(); // 上传文件
  await this.connectServer(); // 服务端部署
}

function cmd(command, opts = {} ) {
	return new Promise((resolve, reject) => {
		let cmd_list = command.split(" ");
		let child = execa(cmd_list.shift(), cmd_list, {
			cwd: opts.cwd || '',
			stdio: ["inherit", "pipe", "inherit"],
		});
		child.stdout.on("data", (buffer) => {
			let str = buffer.toString();
			if (/warning/.test(str)) {
				return;
			}
      let show = opts.show || true;
      if(show){
        process.stdout.write(buffer);
      }
		});
		child.on("close", (code) => {
			if (code !== 0) {
				reject(new Error(`command failed: ${command}`));
				return;
			}
			resolve();
		});
	});
};
function wait(time){
  return new Promise((resolve)=>{
    setTimeout(()=>{resolve()},time)
  })
};

function Progress(desc, length){
  this.desc = desc || "Progress";
  this.length = length || 50;
}
Progress.prototype.render = function(opts){
  let percent = (opts.loaded / opts.total).toFixed(4); // 计算进度(子任务的 完成数 除以 总数)
  let cell_num = Math.floor(percent * this.length); // 计算需要多少个 █ 符号来拼凑图案
  let cell = "";
  for (var i = 0; i < cell_num; i++) {
    cell += "█";
  }
    // 拼接灰色条
  let empty = "";
  for (var i = 0; i < this.length - cell_num; i++) {
    empty += "░";
  }
  var cmdText = this.desc + ": " + (100 * percent).toFixed(2) + "% " + cell + empty + " " + opts.loaded + "/" + opts.total;
  slog(cmdText);
}
Progress.prototype.draw = function(loaded, total){
  if(loaded <= total ){
    this.render({loaded, total});
  }
};

module.exports = async function(option = {}, fn = ()=>{}){
  let generator = new Generator(option, fn);
  await generator.start();
};