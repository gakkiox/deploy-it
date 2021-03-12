## 前端项目自动化部署

现在还属于玩具级别！

##### 实例
传入得`option`参数内容如下
```javascript

const deploy = require('deploy-it');

;(async ()=>{
  let option = {
    user: 'root',
    password: "8848",
    host: "127.0.0.1", 
    port: 22,
    uploadPath: "/www/wwwroot/", // 需要上传到服务器的具体目录
    sshKey: `  // 服务器ssh私钥
  -----BEGIN RSA PRIVATE KEY-----
  MIIEowIBAAKCAQEA3FDceAhIXjSO12VYKkxNB+WiYzXaCTDHBSK4543A/2GmMwAc
  ccGARdr3fZejKjp4i25kxICIvhymgYBYdPSjJNe7vOZgz0Ogbq0q
  -----END RSA PRIVATE KEY-----
    `, // 参考不要格式化
    spinType: "Spin9" // 加载动画类型 参考io-spin
  };
  inputFn(stream){ // 进入远程服务器后需要执行的命令
    stream.write('echo hello world! \n'); // 命令
    stream.write('exit \n');
  };
  await deploy(option, inputFn); // 异步
  ....<其他代码>
})();

```

Email: [look-dj@outlook.com][look-dj@outlook.com]