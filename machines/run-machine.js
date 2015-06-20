module.exports = {
  friendlyName: 'Run local machine',
  description: 'Run a machine in the specified local pack using the provided input values.',
  extendedDescription: '',
  inputs: {
    machinepackPath: {
      example: '/Users/mikermcneil/machinepack-foo/',
      description: 'The path to the machinepack this machine is a part of (if path is not absolute, will be resolved from the current working directory)',
      required: true
    },
    identity: {
      example: 'foo-bar',
      description: 'The identity of the machine to run.',
      required: true
    },
    inputValues: {
      description: 'A set of input name/value pairs.',
      example: [{
        name: 'someInput',
        value: '==='
      }],
      protect: true
    }
  },
  exits: {
    error: {
      description: 'Unexpected error occurred.'
    },
    notFound: {
      description: 'No machine with that identity exists in this machinepack.'
    },
    unknownInput: {
      description: 'A configured input value does not correspond with a real input in this machine.'
    },
    invalidMachine: {
      description: 'Invalid machine definition'
    },
    cantStringifyOutput: {
      description: 'The return value could not be stringified into JSON - perhaps it contains circular references?',
      example: {
        outcome: 'success',
        output: '===',
        inspectedOutput: '{ stuff: "things" }',
        duration: 2948
      }
    },
    success: {
      variableName: 'whatHappened',
      description: 'Returns object representing the action that was taken.',
      example: {
        outcome: 'success',
        output: '===',
        jsonStringifiedOutput: '{"stuff": "things"}',
        inspectedOutput: '{ stuff: "things" }',
        duration: 2948
      }
    }
  },
  fn: function(inputs, exits) {

    // Dependencies
    var _ = require('lodash');
    var thisPack = require('../');


    // Require the machinepack
    var mp;
    try {
      mp = require(inputs.machinepackPath);
    }
    catch (e) {
      return exits.error(e);
    }

    // Look up the appropriate machine instance
    var machineInstance;
    _.each(mp, function (_machine, methodName) {
      if (_machine.identity === inputs.identity) {
        machineInstance = _machine;
      }
    });
    if (!machineInstance) {
      return exits.notFound();
    }

    // Now run the instantiated machine using the provided input values.
    thisPack.runInstantiatedMachine({
      machineInstance: machineInstance,
      inputValues: inputs.inputValues
    }).exec({
      error: exits.error,
      cantStringifyOutput: exits.cantStringifyOutput,
      unknownInput: exits.unknownInput,
      success: exits.success
    });

  }

};
