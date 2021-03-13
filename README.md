## 前端项目自动化部署

现在还属于玩具级别！

#### 使用方法

1. 在当前项目下创建auto.js
```
  vue-project
  ├── src
  │   ├── App.vue
  │   │   └── ....
  │   └── main.js
+ ├── auto.js
  └── package.json
```
2. 在auto.js中根据您的服务其配置写入如下内容
```javascript
// auto.js
const deploy = require("deploy-it");

(async () => {
	// 请根据您的服务器配置传参
	let option = {
		username: "root",
		password: "8848",
		host: "127.0.0.1",
		port: 22,
	};
	let lifetimes = {
		// 生命周期控制
		builded() {
			console.log("项目已经构建完成"); // 可以执行异步操作
		},
		uploaded(stream) {
			// 在此处执行解压 移动文件等命令
			console.log("压缩包已经上传到服务器");
			stream.write("unzip -o ./dist.zip \n"); // 解压命令
			stream.write("exit \n");
		},
	};
	await deploy(option, lifetimes); // 异步
	....<其他代码>
})();

```

3. 在`package.json`中加入运行脚本

```json
	"scripts": {
		"auto": "node ./auto.js"
	},
```

4. 然后执行`npm run auto`即可自动部署！
从本地上传文件到服务器时需要输入用户密码，记得输入哟！

#### 参数详解

`option`配置参数详解

```javascript
let option = {
	username: "root", // 用户名
	password: "8848", // 用户密码
	host: "127.0.0.1", // 服务器IP
	port: 22, // 服务器端口号
	privateKey: `PRIVATE KEY`, // 服务器ssh私钥 不要格式化 可以使用fs.readFileSync 经行读取
	uploadPath: "/", // 需要上传到服务器的具体目录 默认上传至根目录
	spinType: "Spin9", // 加载动画类型 参考io-spin,
	build: "npm run build", // 项目打包命令
	floder: "dist", // 打包完成后生成的文件夹名称
	useKey: false, // 是否使用privateKey经行登录
};

```

`lifetimes`生命周期参数详解

``` javascript
let lifetimes = {
	async builded() {
		// 可在此处对已经打包的项目文件经行再操作
		let file = fs.readFileSync("/dist/.index.html").toString();
		console.log(file);
	},
	uploaded(stream) {
		// 在此处执行服务器命令  解压 移动文件等命令
		console.log("压缩包已经上传到服务器");
		stream.write("unzip -o ./dist.zip \n"); // 解压命令
		stream.write("exit \n");
	},
};


```
#### 联系方式

Email: [look-dj@outlook.com](look-dj@outlook.com)