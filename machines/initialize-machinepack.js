module.exports = {
  friendlyName: 'Initialize machinepack',
  description: 'Initilize or rename a local pack by modifying its package.json file.',
  extendedDescription: 'Modifies the package\'s package.json file.',
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
    success: {
      description: 'Done.'
    }
  },
  fn: function(inputs, exits) {

    var Path = require('path');
    var _promptAboutNewMachinepack = require('machine').build(require('./prompt-about-new-machinepack'));
    var Filesystem = require('machinepack-fs');

    var machinepackPath = Path.resolve(process.cwd(), inputs.dir);
    var packageJsonPath = Path.resolve(machinepackPath, 'package.json');


    _promptAboutNewMachinepack().exec({
      error: function (err){
        return exits.error(err);
      },
      then: function (metadata){
        Filesystem.readJson({
          source: packageJsonPath,
          schema: {}
        }).exec({
          error: function (err){
            return exits.error(err);
          },
          success: function (jsonData){
            jsonData.machinepack = jsonData.machinepack || {};
            jsonData.machinepack.friendlyName = metadata.friendlyName || jsonData.machinepack.friendlyName;
            jsonData.machinepack.machines = jsonData.machinepack.machines || [];
            jsonData.description = metadata.description || jsonData.description;
            jsonData.machinepack.machineDir = jsonData.machinepack.machineDir || 'machines/';

            (function (done){
              Filesystem.mkdir({
                destination: jsonData.machinepack.machineDir
              }).exec({
                error: function (err){
                  return done(err);
                },
                // If something already exists at the machine directory path, no problem,
                // just ignore it and continue -- we definitely won't try to overwrite it.
                alreadyExists: function (){
                  return done();
                },
                success: function (){
                  return done();
                }
              });
            })(function (err) {
              if (err){
                return exits.error(err);
              }

              Filesystem.writeJson({
                json: jsonData,
                destination: packageJsonPath,
                force: true
              }).exec({
                error: function (err){
                  return exits.error(err);
                },
                success: function (){
                  // Done.
                  return exits.success();
                }
              });
            });
          }
        });
      }
    });


  },

};
