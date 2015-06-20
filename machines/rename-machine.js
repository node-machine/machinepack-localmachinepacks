module.exports = {
  friendlyName: 'Rename machine',
  description: 'Rename a machine in a local pack and update the package.json file.',
  extendedDescription: '',
  inputs: {
    dir: {
      description: 'The path to the machinepack (if path is not absolute, will be resolved from the current working directory)',
      example: '/Users/mikermcneil/machinepack-foo/',
      required: true
    },
    originalIdentity: {
      description: 'Identity of the machine to rename',
      example: 'do-stuff',
      required: true
    },
    newIdentity: {
      description: 'New identity for the machine',
      example: 'do-stuff-with-a-better-name',
      required: true
    }
  },
  exits: {
    error: {
      description: 'Unexpected error occurred.'
    },
    notFound: {
      description: 'No machine with the specified identity exists in this machinepack.'
    },
    success: {
      description: 'Done.'
    }
  },
  fn: function(inputs, exits) {

    var Path = require('path');
    var _ = require('lodash');
    var Filesystem = require('machinepack-fs');
    var _getMachinesDir = require('machine').build(require('./get-machines-dir'));

    var machinepackPath = Path.resolve(process.cwd(), inputs.dir);
    var packageJsonPath = Path.resolve(machinepackPath, 'package.json');


    _getMachinesDir({
      dir: machinepackPath
    }).exec({
      error: function (err){
        return exits.error(err);
      },
      success: function (pathToMachines){

        Filesystem.mv({
          source: Path.resolve(pathToMachines, inputs.originalIdentity+'.js'),
          destination: Path.resolve(pathToMachines, inputs.newIdentity+'.js')
        }).exec({

          error: function (err){
            return exits.error(err);
          },

          success: function (){

            Filesystem.readJson({
              source: packageJsonPath,
              schema: {}
            }).exec({
              error: function (err){
                return exits.error(err);
              },
              success: function (jsonData){
                try {
                  jsonData.machinepack.machines = _.difference(jsonData.machinepack.machines, [inputs.originalIdentity]);
                  jsonData.machinepack.machines = _.union(jsonData.machinepack.machines, [inputs.newIdentity]);
                }
                catch (e) {
                  return exits.error(e);
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
              }
            });
          },
        });
      }
    });
  },

};
