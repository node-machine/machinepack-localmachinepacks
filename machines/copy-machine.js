module.exports = {


  friendlyName: 'Copy machine',


  description: 'Copy a machine in a local pack and update the package.json file.',


  inputs: {

    dir: {
      description: 'The path to the machinepack (if path is not absolute, will be resolved from the current working directory)',
      example: '/Users/mikermcneil/machinepack-foo/',
      required: true
    },

    originalIdentity: {
      description: 'Identity of the machine to copy',
      example: 'do-stuff',
      required: true
    },

    newIdentity: {
      description: 'Identity of the new machine',
      example: 'copy-of-do-stuff',
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
        console.error('Unexpected error occurred:\n',err);
      },
      success: function (pathToMachines){

        Filesystem.cp({
          source: Path.resolve(pathToMachines, inputs.originalIdentity+'.js'),
          destination: Path.resolve(pathToMachines, inputs.newIdentity+'.js')
        }).exec({

          error: function (err){
            console.error('Unexpected error occurred:\n',err);
          },

          success: function (){

            Filesystem.readJson({
              source: packageJsonPath,
              schema: {}
            }).exec({
              error: function (err){
                console.error('Unexpected error occurred:\n',err);
              },
              success: function (jsonData){
                try {
                  jsonData.machinepack.machines = _.union(jsonData.machinepack.machines, [inputs.newIdentity]);
                }
                catch (e) {
                  console.error('Unexpected error occurred:\n',err);
                  return;
                }
                Filesystem.writeJson({
                  json: jsonData,
                  destination: packageJsonPath,
                  force: true
                }).exec({
                  error: function (err){
                    console.error('Unexpected error occurred:\n',err);
                  },
                  success: function (){
                    // Done.
                    console.log('Copied: `%s` to new machine: `%s`', inputs.originalIdentity, inputs.newIdentity);
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
