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

Log.prototype.green = function(str){
  this.log(chalk.green(str))
};

const log = new Log();

function Generator(option, lifetimes){
  this.option = option;
  this.dir = process.cwd();
  this.lifetimes = lifetimes;
  this.sshForm = {};
};
Generator.prototype.checkOption = function(){
  let option = this.option;
  if(!option || typeof option != 'object'){
    throw new Error('option param error');
  };
  if(!option.username || typeof option.username != 'string'){
    throw new Error('option.username param error');
  };
  if(!option.password || typeof option.password != 'string'){
    throw new Error('option.password param error');
  };
  if(!option.host || typeof option.host != 'string'){
    throw new Error('option.host param error');
  };
  let { host, privateKey, port, username, password } = option;
  if(!option.useKey){
    this.sshForm = { host, port, username, password }
  }else{
    this.sshForm = { host, port, username, privateKey }
  }
};

Generator.prototype.testConnect = async function(){
  let { option, sshForm } = this, { spinType } = option;
  let spinner = spin(chalk.green('✨ 正在测试连接远程服务器...'), spinType);
  spinner.start();
  await wait(1000);
  return new Promise((resolve,reject)=>{
    const conn = new Client();
    conn
    .on('ready', () => {
      // log.blue("Client :: ready");
      spinner.stop();
      conn.exec('uptime', (err, stream) => {
        if (err) throw err;
        stream.on('close', (code, signal) => {
          if (code !== 0) {
            log.red('> 测试连接远程服务器失败');
            reject(new Error(`Failed to connect to server`))
            return
        }
          conn.end();
          log.red('> 测试连接远程服务器成功');
          resolve();
        }).on('data', (data) => {
          // log.yellow('STDOUT: ' + data);
        }).stderr.on('data', (data) => {
          // log.yellow('STDERR: ' + data);
        });
      });    
    })
    .connect(sshForm)
  })
};

Generator.prototype.build = async function(){
  let { build } = this.option;
  log.red('> 开始打包项目');
  await cmd(build, { show: false, cwd: this.dir });
  await this.lifetimes.builded.call(this);
  log.red('> 打包完成');
};

Generator.prototype.compress = async function(){
  let { floder, spinType } = this.option;
  log.red('> 开始压缩项目');
  let spinner = spin(chalk.green('✨ 正在压缩打包后的项目...'), spinType);
  spinner.start();
  let source = path.resolve(this.dir, floder), compressedName = floder + '.zip';
  let compressPath = this.option.compressPath = path.resolve(this.dir, compressedName);
  if(fs.existsSync(compressPath)){
    fs.removeSync(compressPath)
  }
  await compressing.zip.compressDir(source, compressedName);
  await wait(1000);
  spinner.stop();
  log.red('> 压缩完成');
};

Generator.prototype.uploadFile = async function(){
  log.red(`> 请输入${this.option.username}用户的密码，开始上传项目压缩包`);
  let  { compressPath, username, host, uploadPath } = this.option;
  await cmd(`scp ${ compressPath} ${ username }@${ host }:${ uploadPath }`, { show: true });
  fs.remove(compressPath);
  log.red('> 上传完毕');
};

Generator.prototype.connectServer = async function(){
  let { option, sshForm } = this, { spinType } = option;
  log.red('> 开始连接远程服务器');
  let spinner = spin(chalk.green('✨ 正在连接远程服务器...'), spinType);
  spinner.start();
  await wait(500);
  return new Promise((resolve,reject)=>{
    const conn = new Client();
    conn.on('ready', () => {
      log.red("\n> 连接远程服务器成功");
      spinner.stop();
      conn.shell((err, stream) => {
        if (err) throw err;
        stream.on('close', () => {
          log.red("> 断开远程服务器连接");
          conn.end();
          resolve();
        })
        .on('data', (data) => {
          log.yellow('OUTPUT: ' + data);
        });
        this.lifetimes.uploaded.call(this, stream);
      });   
    }).connect(sshForm);
  })
};

Generator.prototype.start = async function(){
  try{
    let time = new Date().valueOf(), end = 0;
    this.checkOption(); // 检查参数
    await this.testConnect(); // 测试链接
    await this.build(); // 打包项目
    await this.compress(); // 压缩文件
    await this.uploadFile(); // 上传文件
    await this.connectServer(); // 服务端部署
    end = new Date().valueOf() - time;
    log.green('项目自动部署成功，共用时' + Math.round(end / 10 )/100 + 's', );
  }catch(e){
	console.log('\n')
    console.log(e);
    process.exit();
  }
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
      if(opts.show){
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

module.exports = async function({
  username = 'root',
  password = "8848",
  host = "127.0.0.1", 
  port = 22,
  privateKey =`PRIVATE KEY`, 
  uploadPath = "/",
  spinType = "Spin9",
  build = "npm run build",
  floder = 'dist',
  useKey = false,
},{
	uploaded = ()=>{},
	builded = ()=>{}
}){
  let option = { username, password, host, port, privateKey, uploadPath, spinType, build, floder, useKey };
  let lifetimes = { uploaded, builded };
  let generator = new Generator( option, lifetimes );
  await generator.start();
};