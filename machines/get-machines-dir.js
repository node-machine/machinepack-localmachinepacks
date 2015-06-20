module.exports = {

  friendlyName: 'Get machines directory',

  description: 'Get the path to this machinepack\'s `machines/` directory.',

  cacheable: true,

  inputs: {

    // `dir` is the path to the machinepack of interest
    dir: {
      example: '/Users/mikermcneil/machinepack-foobar',
      required: true
    }
  },

  defaultExit: 'success',

  exits: {
    error: {
      description: 'Unexpected error occurred.',
    },
    success: {
      description: 'Machine ran successfully.',
      example: '/Users/mikermcneil/machinepack-foobar/machines'
    }
  },

  fn: function (inputs, exits){

    var Path = require('path');

    require('machine').build(require('./read-package-json'))
    .configure({
      dir: inputs.dir
    }).exec({
      error: exits.error,
      notMachinepack: exits.notMachinepack,
      success: function (machinepack){
        return exits.success(Path.resolve(inputs.dir, machinepack.machineDir));
      }
    });

  }
};
