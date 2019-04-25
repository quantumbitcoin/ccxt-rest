#!/usr/local/bin/node

const fs = require('fs');
const execSync = require('child_process').execSync;

const widdershins_output_file = './docs/source/_tmp.html.md'

// https://stackoverflow.com/questions/18052762/remove-directory-which-is-not-empty#answer-32197381
var _deleteFolderRecursive = function(path) {
    if (fs.existsSync(path)) {
      fs.readdirSync(path).forEach(function(file, index){
        var curPath = path + "/" + file;
        if (fs.lstatSync(curPath).isDirectory()) { // recurse
            _deleteFolderRecursive(curPath);
        } else { // delete file
          fs.unlinkSync(curPath);
        }
      });
      fs.rmdirSync(path);
    }
  };
  
  function run_command(command, params) {
    console.info('[START] `' + command + '`...')
    if (params && !params.stdio) {
        params.stdio = 'inherit'
    }
    execSync(command, params);
    console.info('[END] `' + command + '`...')
}

function ensure_submodule_exists() {
    if (!fs.existsSync('./docs/Rakefile')) {
        run_command('git submodule init docs')
        run_command('git submodule update docs')
    }
}

function widdershins() {
    var command = [
        "./node_modules/.bin/widdershins", 
        "--search", "true", 
        "--language_tabs", "'shell:Shell'", "'go:Go'", "'java:Java'", "'javascript:Javascript'", "'python:Python'", "'ruby:Ruby'", 
        "--summary", "api/swagger/swagger.yaml", 
        "-o", widdershins_output_file
    ]
    run_command(command.join(' '));
}

function split_widdershins_output() {
    console.info('[START] split_widdershins_output()...')
    const data = fs.readFileSync(widdershins_output_file, 'utf8')

    const delimiter = '<h1 id="ccxt-rest-authentication-api">Authentication API</h1>'
    segments = data.split(delimiter);

    fs.writeFileSync("./docs/source/00_generated_header.html.md", [segments[0], '\n'].join(''));
    fs.writeFileSync("./docs/source/50_generated_api.html.md", ['\n', delimiter, segments[1]].join(''));

    fs.unlinkSync(widdershins_output_file)

    console.info('[END] split_widdershins_output()...')
}

function docs_build() {
    run_command('rake build', {cwd:'./docs'});
    if (!fs.existsSync('./docs/build')) {
        console.error('Should have been able to find ./docs/build but did not')
        process.exit(1)
    }
}

function delete_out_docs() {
    console.info('[START] delete_out_docs()...')
    _deleteFolderRecursive('./out/docs')
    console.info('[END] delete_out_docs()...')
}

function move_docs_build_to_out_docs() {
    console.info('[START] move_docs_build_to_out_docs()...')
    if (!fs.existsSync('./out')) {
        fs.mkdirSync('./out')
    }
    if (!fs.existsSync('./out')) {
        console.error('Should have been able to find ./docs but did not')
        process.exit(1)
    }
    try {
        // this code fails inside docker
        fs.renameSync('docs/build', 'out/docs')
    } catch (err) {
        // so we fallback to something we know will work inside node:10.4.0-alpine
        run_command('mv docs/build out/docs')
    }
    console.info('[END] move_docs_build_to_out_docs()...')
}

ensure_submodule_exists();
widdershins();
split_widdershins_output();
docs_build();
delete_out_docs();
move_docs_build_to_out_docs();
