const express = require('express');
const app = express();
const port = 9000;
var server = app.listen(port);
var io = require('socket.io').listen(server);
const http = require('http')
const socketIO = require('socket.io')
const bodyParser = require('body-parser');
const fs = require('fs');
const prompt = require('prompt');
const cmd = require('node-command-line'),
  Promise = require('bluebird');
const colors = require('colors/safe');
prompt.message = colors.bgGreen(' ');
prompt.delimiter = colors.green(' ');
const ora = require('ora');
const spinner = ora('Loading Data');
const promisify = require('node-promisify');
var moment = require('moment');
io.on('connection', socket => {
  const obj_temp = {
    projectName: '',
    packages_data: '',
    count_LifeCycle_install_pkg: 0,
    scratch_org_alias: '',
    scratch_org_id: '',
    scratch_org_username: '',
  };
  global.socket_message = "🤝 Connection Success";
  global.socket_SO_userdata = 0;
  global.scratch_org_alias = "";
  const config = {
    login_URL_default: 'https://login.salesforce.com/',
    login_Alias_default: 'Prod',
  };

  function Head(value) {
    return colors.bgBlue(' ' + colors.white(colors.bold(value)) + ' ')
  }

  function error(value) {
    return colors.yellow(value)
  }

  function success(value) {
    return colors.green(value)
  }

  function convertToJson(value) {
    return JSON.stringify(value)
  }
  app.use(bodyParser.urlencoded({
    extended: !1
  }));
  app.use(bodyParser.json())
  app.use(function(req, res, next) {
    res.setHeader('Access-Control-Allow-Origin', 'http://127.0.0.1:8080');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');
    res.setHeader('Access-Control-Allow-Credentials', !0);
    next()
  });
  app.post('/SO', function(req, res) {
    scratch_org_alias = req.body.alias;
    obj_temp.projectName = req.body.projectName;

    function processInstallation_emit(i) {
      if (obj_temp.count_LifeCycle_install_pkg > i) {
        var val_frm_pkg_json = {
          name: obj_temp.packages_data[i].package_name,
          ver_id: obj_temp.packages_data[i].package_version,
          key: obj_temp.packages_data[i].package_key,
        };
        console.log(val_frm_pkg_json);
        Promise.coroutine(function*() {
          var command = '';
          if (val_frm_pkg_json.key) {
            command = 'sfdx force:package:install -i ' + val_frm_pkg_json.ver_id + ' -k ' + val_frm_pkg_json.key + ' -u ' + scratch_org_alias
          } else {
            command = 'sfdx force:package:install -i ' + val_frm_pkg_json.ver_id + ' -u ' + scratch_org_alias
          }
          var response = yield cmd.run(command);
          spinner.start('Loading..');
          socket_message = i+" PackageInstallRequest is currently InProgress , please wait..!";
          if (response.success) {
            console.log(response);
            var packageStatusCheckPattern = /sfdx\sforce:package:install:get\s-i\s[A-Za-z\d]{18}\s-u\s[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,3}/g;
            var packageStatusCheckPatternResolvedArray = packageStatusCheckPattern.exec(response.message);
            if (packageStatusCheckPatternResolvedArray && packageStatusCheckPatternResolvedArray.length > 0) {
              var installationStatusCheckCommand = packageStatusCheckPatternResolvedArray[0]
            }
            if (!installationStatusCheckCommand) {
              return
            }
            var checkInstallationStatus = setInterval(function() {
              spinner.stop();
              spinner.start('Package install requested..');
              socket_message = "Installing package number" + i;
              console.log(installationStatusCheckCommand);
              Promise.coroutine(function*() {
                spinner.stop();
                spinner.start('Loading...');
                socket_message = i+" Package installation in queue....";
                var response = yield cmd.run(installationStatusCheckCommand);
                if (response.success) {
                  var installationSuccessPattern = /Successfully\sinstalled\spackage\s\[/g;
                  var installationSuccessResolvedArray = installationSuccessPattern.exec(response.message);
                  if (installationSuccessResolvedArray && installationSuccessResolvedArray.length > 0) {
                    spinner.stop();
                    spinner.succeed(success(installationSuccessResolvedArray[0]));
                    socket_message = installationSuccessResolvedArray[0];
                    for_increment_install(i);
                    clearInterval(checkInstallationStatus)
                  }
                  spinner.stop();
                  spinner.start('Installation process in queue...');
                  socket_message = i+" Installation process in queue..."
                } else {
                  console.log(error('Package queue failed, Please contact administrator'));
                  socket_message = "Package queue failed, Please contact administrator";
                  console.log(response)
                }
              })()
            }, 120000)
          } else {
            console.log(error('Package installation got failed'));
            socket_message = "Package installation got failed";
            spinner.stop()
          }
        })()
      } else {
        console.log(success('Package installation process completed'));
        socket_message = "Package installation process completed";
        socket.emit('so_creation', socket_message);
        setInterval(function() {
          socket.emit('so_creation', socket_message)
        }, 1000);
        spinner.stop()
      }
    }

    function for_increment_install(i) {
      processInstallation_emit(i + 1)
    }

    function processInstallation_init(value) {
      obj_temp.packages_data = JSON.parse(value).Packages;
      obj_temp.count_LifeCycle_install_pkg = JSON.parse(value).Packages.length;
      if (obj_temp.count_LifeCycle_install_pkg > 0) processInstallation_emit(0);
      else
        socket_message = "No packages to install";
      console.log('No packages to install')
    }

    function responseEmit(params) {
      socket_message = "Package installation yet to begin..";
      socket_SO_userdata = JSON.parse(params);
      socket.emit('so_creation', socket_message);
      socket.emit('so_creation_org_details', socket_SO_userdata);
      res.send(req.body);
      fs.readFile('config/configdata.json', 'utf8', function readFileCallback(err, data) {
        processInstallation_init(data)
      })
    }

    function displayScratchOrg(value) {
      socket_message = "🆕 Displaying SO Details 🌟"
      spinner.start('Loading..');
      Promise.coroutine(function*() {
        const response = yield cmd.run('sfdx force:org:display -u ' + scratch_org_alias + ' --json');
        if (response.success) {
          socket_message = "😀 Copy your SO Details 🌟";
          responseEmit(response.message)
          spinner.stop()
        } else {
          socket_message = "👺 Someting went wrong contact admin 👀";
          console.log(error('Invalid Comment, Please contact administrator'));
          spinner.stop()
        }
      })()
    }

    function generatePassword(value) {
      socket_message = "🏋️‍ Genrating password... 📢";
      spinner.start('Loading..');
      setTimeout(() => {
        spinner.color = 'yellow';
        spinner.text = 'Generating password...';
        socket_message = "🏋️‍ Please wait... Generating password 📢"
      }, 1000);
      Promise.coroutine(function*() {
        var response = yield cmd.run('sfdx force:user:password:generate -u ' + scratch_org_alias);
        if (response.success) {
          spinner.stop();
          spinner.succeed('Password generated successfully');
          socket_message = "Password generated successfully ✔️";
          displayScratchOrg(scratch_org_alias)
        } else {
          socket_message = "👺 Someting went wrong contact admin 👀";
          console.log(error('Invalid Comment, Please contact administrator'));
          spinner.stop()
        }
      })()
    }

    function create_scratch_org(value, process) {
      socket_message = "👨🏻‍💻 Creating SO for " + scratch_org_alias;
      spinner.start('Loading..');
      setTimeout(() => {
        spinner.color = 'yellow';
        spinner.text = 'Creating scratch org...';
        socket_message = "Please wait... 🕑 creating SO for " + scratch_org_alias
      }, 1000);
      scratch_org_alias = value;
      Promise.coroutine(function*() {
        var response = yield cmd.run('sfdx force:org:create -f ' + obj_temp.projectName + '/config/project-scratch-def.json -a ' + scratch_org_alias + ' -d 30');
        if (response.success) {
          spinner.succeed('Org created successfully');
          socket_message = "SO successfully ⛳️ created for " + scratch_org_alias;
          generatePassword(scratch_org_alias)
        } else {
          socket_message = "👺 Someting went wrong contact admin 👀";
          console.log(error('Invalid Comment, Please contact administrator'));
          spinner.stop()
        }
      })()
    }

    function create_Project(value, process) {
      socket_message = "📁 Creating project...🕔 ";
      spinner.start('Loading..');
      setTimeout(() => {
        spinner.color = 'yellow';
        spinner.text = 'Creating project...';
        socket_message = "📁 Creating project...🕣 "
      }, 1000);
      Promise.coroutine(function*() {
        const response = yield cmd.run('sfdx force:project:create -n ' + value);
        if (response.success) {
          spinner.succeed('Project created successfully');
          fs.exists('./config/project-scratch-def.json', function(exists) {
            if (exists) {
              fs.readFile('./config/project-scratch-def.json', 'utf8', function readFileCallback(err, data) {
                fs.writeFile('./' + value + '/config/project-scratch-def.json', data, 'utf8', function readFileCallback(err, data) {
                  spinner.succeed('Project created successfully');
                  socket_message = " 📩 Project Successfully Created ⛳️ ";
                  create_scratch_org(scratch_org_alias)
                })
              })
            }
          })
        } else {
          socket_message = "👺 Someting went wrong contact admin 👀";
          console.log(error('Invalid Comment, Please contact administrator'));
          spinner.stop()
        }
      })()
    }

    function cmd_Exec(value, process) {
      spinner.start('Loading..');
      setTimeout(() => {
        spinner.color = 'yellow';
        spinner.text = process
      }, 1000);
      Promise.coroutine(function*() {
        const response = yield cmd.run(value);
        if (response.success) {
          spinner.stop();
          console.log(success('User LoggedIn successfully'));
          console.log(obj_temp.projectName);
          create_Project(obj_temp.projectName);
          socket_message = "User LoggedIn successfully 🤙"
        } else {
          socket_message = "👺 Someting went wrong contact admin 👀";
          console.log(error('Invalid Comment, Please contact administrator'));
          spinner.stop()
        }
      })()
    }
    var _cmd_login = 'sfdx force:auth:web:login -r https://login.salesforce.com/ -d -a ' + scratch_org_alias;
    cmd_Exec(_cmd_login, 'Waiting for loggin into salesforce..!')
  });
  setInterval(function() {
    socket.emit('so_creation', socket_message);
    socket.emit('so_creation_org_details', socket_SO_userdata)
  }, 1000)
})
console.log('Server started! At http://localhost:' + port)