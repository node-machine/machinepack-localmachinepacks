module.exports = {
  friendlyName: 'Read machinepack metadata (package.json)',
  description: 'Read and parse the package.json file of a local pack in the specified directory.',
  extendedDescription: '',
  cacheable: true,
  inputs: {
    dir: {
      description: 'The path to the machinepack (if path is not absolute, will be resolved from the current working directory)',
      example: '/Users/mikermcneil/machinepack-foo/',
      required: true
    }
  },
  exits: {
    error: {
      description: 'Unexpected error occurred.'
    },
    notMachinepack: {
      description: 'The specified path is not the root directory of a machinepack'
    },
    success: {
      description: 'Done.',
      example: {
        npmPackageName: 'machinepack-facebook',
        identity: 'machinepack-facebook',
        friendlyName: 'Facebook',
        variableName: 'Facebook',
        description: 'asg',
        extendedDescription: 'blah blah',
        moreInfoUrl: 'http://machinepack-facebook.org',
        iconSrc: 'http://machinepack-facebook.org/icon.png',
        version: '0.1.1',
        keywords: ['machine'],
        latestVersionPublishedAt: '2015-01-19T22:26:54.588Z',
        author: 'Marty McFly <marty@mcfly.com>',
        nodeMachineUrl: 'http://node-machine.org/machinepack-foo',
        docsUrl: 'http://node-machine.org/machinepack-foo',
        npmUrl: 'http://npmjs.org/package/machinepack-foo',
        sourceUrl: 'https://github.com/baz/machinepack-foo',
        githubUrl: 'https://github.com/baz/machinepack-foo',
        testsUrl: 'https://travis-ci.org/baz/machinepack-foo',
        machineDir: 'machines/',
        machines: ['do-a-thing'],
        contributors: [{
          name: 'Doc Brown',
          email: 'doc@brown.com'
        }],
        dependencies: [{
          name: 'lodash',
          semverRange: '^2.4.1'
        }],
        license: 'MIT'
      }
    }
  },
  fn: function(inputs, exits) {

    var Path = require('path');
    var Machine = require('machine');
    var Filesystem = require('machinepack-fs');

    var machinepackPath = Path.resolve(process.cwd(), inputs.dir);
    var packageJsonPath = Path.resolve(machinepackPath, 'package.json');

    Filesystem.read({
      source: packageJsonPath
    }).exec({
      error: function (err){
        return exits.error(err);
      },
      doesNotExist: function (){
        return exits.notMachinepack();
      },
      success: function (jsonString){

        // Parse machinepack metadata from its package.json string.
        try {
          var machinepackMetadata = Machine.build(require('./parse-machinepack-metadata')).configure({
            json: jsonString,
          }).execSync();

          return exits.success(machinepackMetadata);
        }
        catch (e) {
          return exits(e);
        }
      }
    });

  },

};
