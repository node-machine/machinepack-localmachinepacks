module.exports = {
  friendlyName: 'Read machine file',
  description: 'Read machine file located at the specified path into a JSON string w/ stringified functions.',
  extendedDescription: '',
  inputs: {
    source: {
      example: '/Users/mikermcneil/machinepack-foo/machines/bar.js',
      description: 'The path to the machine file (if path is not absolute, will be resolved from the current working directory)',
      required: true
    }
  },
  exits: {
    error: {
      description: 'Unexpected error occurred.'
    },
    notFound: {
      description: 'No file exists at the specified path'
    },
    couldNotStringify: {
      description: 'Could not stringify machine definition into JSON.'
    },
    success: {
      description: 'Returns machine definition as a JSON string.',
      example: '{friendlyName: "Do something", ... }'
    }
  },
  fn: function(inputs, exits) {

    var Path = require('path');

    var machinePath = Path.resolve(process.cwd(), inputs.source);

    // console.log(' •-> Reading machine file located @', machinePath);

    // TODO: clear this part of the require cache
    // ...

    // TODO:
    // psuedo-"sandbox" the require of this machine
    // (not a real sandbox, just enough to reasonably catch weird stuff during development)
    var machineDef;
    try {
      machineDef = _.cloneDeep(require(machinePath));

      // TODO:
      // validate that no code exists outside module.exports
    }
    catch(e){
      // Look for MODULE_NOT_FOUND error from Node core- but make sure it's a require error
      // from the actual module itself, and not one of its dependencies! To accomplish that-
      // check that the error message string ends in `/package.json'` (note the trailing apostrophe)
      if (e.code === 'MODULE_NOT_FOUND' && typeof e.message==='string' && e.message.match(new RegExp(machinePath))) {
        return exits.notFound(e);
      }
      return exits.error(e);
    }

    // Convert `fn` to string.
    machineDef.fn = machineDef.fn.toString();
    // (TODO: clean up function signature first.)

    // Encode as json
    var jsonMachineDefinition;
    try {
      jsonMachineDefinition = JSON.stringify(machineDef);
    }
    catch (e) {
      return exits.couldNotStringify(e);
    }

    return exits.success(jsonMachineDefinition);
  },

};
