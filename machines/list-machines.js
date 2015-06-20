module.exports = {


  friendlyName: 'List machines',


  description: 'List the machines in a local pack.',


  cacheable: true,


  inputs: {

    dir: {
      description: 'The path to the machinepack (if path is not absolute, will be resolved from the current working directory)',
      example: '/Users/mikermcneil/machinepack-foo/',
      required: true
    }

  },


  exits: {

    notMachinepack: {
      description: 'The specified path is not the root directory of a machinepack'
    },

    success: {
      description: 'Done.',
      example: ['do-a-thing','do-something-else']
    }

  },


  fn: function(inputs, exits) {

    require('machine').build(require('./read-package-json'))
    .configure({
      dir: inputs.dir
    }).exec({
      error: exits.error,
      notMachinepack: exits.notMachinepack,
      success: function (machinepack){
        // Return list of machines, sorted alphabetically for easier reading
        var machineIdentities = machinepack.machines.sort();
        return exits.success(machineIdentities);
      }
    });

  }


};
