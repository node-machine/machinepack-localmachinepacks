module.exports = {


  friendlyName: 'Build machine code',


  description: 'Build a JavaScript code string which represents the provided machine metadata.',


  cacheable: true,


  sync: true,


  inputs: {

    friendlyName: {
      example: 'Do something',
      required: true,
    },

    description: {
      example: 'Do something useful given stuff; maybe return something else.',
      defaultsTo: ''
    },

    extendedDescription: {
      description: 'The optional `extendedDescription` property for the generated machine definition.',
      example: '...lots of words...'
    },

    moreInfoUrl: {
      description: 'The optional `moreInfoUrl` property for the generated machine definition.',
      example: 'http://www.cis.upenn.edu/~treebank/tokenization.html'
    },

    fn: {
      description: 'The stringified contents of the machine function (`fn`).',
      example: '  return exits.success();'
    },

    cacheable: {
      description: 'Whether or not this machine should be marked as `cacheable`.',
      example: false,
      defaultsTo: false
    },

    sync: {
      description: 'Whether or not this machine can be run synchronously (with `.execSync()`).',
      example: false,
      defaultsTo: false
    },

    idempotent: {
      description: 'Whether or not running this machine multiple times achieves different results (ceteris paribus.)',
      example: false
    },

    environment: {
      description: 'An optional array of environment objects. If specified, the machine will depend on these objects in order to work.',
      extendedDescription: 'Environments are an experimental feature of the machine spec. For more on environments, see https://groups.google.com/forum/#!searchin/node-machine/environment/node-machine/yipvJSiIj_Q/Wqm1RCOn070J',
      example: ['req']
    },

    inputs: {
      description: 'The `inputs` definition object for this machine.',
      example: {}
    },

    exits: {
      description: 'The `exits` definition object for this machine.',
      example: {}
    },

  },


  exits: {

    error: {
      description: 'Unexpected error occurred.',
    },

    couldNotParseFnInsideInput: {},
    couldNotParseFnInsideExit: {},

    couldNotParseFn: {
      description: 'The provided `fn` could not be parsed as a function.'
    },

    success: {
      description: 'Machine ran successfully.',
      example: 'module.exports = { friendlyName: "Do something", inputs: {}, exits: { error: {}, success: {} }, fn: function (inputs, exits){} };'
    }

  },

  fn: function (inputs, exits){

    var util = require('util');
    var rttc = require('rttc');
    var _ = require('lodash');

    // Wrap any `getExample` function strings in a function wrapper, and convert
    // to a real js function.
    try {
      inputs.exits = _.mapValues(inputs.exits, function (exitDef, exitId){
        if (_.isString(exitDef.getExample)) {
          exitDef.getExample = new Function('inputs','env', exitDef.getExample);
        }
        // Never include an `example` (or a substitute like `itemOf`) if this is the `error` exit
        // and also make sure it's never `void`.
        // (that's because it smashes the error instance and therefore the stack trace!)
        if (exitId === 'error') {
          delete exitDef.void;
          delete exitDef.example;
          delete exitDef.like;
          delete exitDef.itemOf;
          delete exitDef.getExample;
        }
        return exitDef;
      });
    }
    catch (e){
      return exits.couldNotParseFnInsideExit(e);
    }

    // Wrap any `validate` or `defaultsTo` function strings in a function wrapper,
    // and convert to a real js function.
    try {
      inputs.inputs = _.mapValues(inputs.inputs, function (inputDef, inputId){
        if (_.isString(inputDef.validate)) {
            inputDef.validate = new Function('inputs','env', inputDef.validate);
        }

        // Hydrate any functions in the `defaultsTo`:
        if (inputDef.defaultsTo) {
          inputDef.defaultsTo = rttc.hydrate(inputDef.defaultsTo, rttc.infer(inputDef.example));
        }

        return inputDef;
      });
    }
    catch (e){
      return exits.couldNotParseFnInsideInput(e);
    }

    // Parse encoded `fn` to a real JavaScript function, then `toString` it again.
    var fn;
    if (inputs.fn) {
      try {
        fn = new Function('inputs', 'exits', 'env', inputs.fn);
        fn = fn.toString().replace(/anonymous/, '').replace(/\n/g,'\n  ');
      }
      catch (e){
        return exits.couldNotParseFn(e);
      }
    }
    else {
      fn = new Function('inputs', 'exits', util.format('  return exits.%s();', 'success'));
      fn = fn.toString().replace(/anonymous/, '').replace(/\n/g,'\n  ');
    }
    // console.log('*********** BUILDING MACHINE CODE ************',util.inspect(inputs,{depth:null}));

    var code = 'module.exports = {\n\n\n';
    code += util.format('  friendlyName: %s,\n\n\n', util.inspect(inputs.friendlyName));
    code += util.format('  description: %s,\n\n\n', util.inspect(inputs.description));
    if (!_.isUndefined(inputs.extendedDescription)) {
      code += util.format('  extendedDescription: %s,\n\n\n', util.inspect(inputs.extendedDescription||''));
    }
    if (!_.isUndefined(inputs.moreInfoUrl)) {
      code += util.format('  moreInfoUrl: %s,\n\n\n', util.inspect(inputs.moreInfoUrl||''));
    }
    if (!_.isUndefined(inputs.cacheable)) {
      code += util.format('  cacheable: %s,\n\n\n', util.inspect(inputs.cacheable));
    }
    if (!_.isUndefined(inputs.sync)) {
      code += util.format('  sync: %s,\n\n\n', util.inspect(inputs.sync));
    }
    if (!_.isUndefined(inputs.idempotent)) {
      code += util.format('  idempotent: %s,\n\n\n', util.inspect(inputs.idempotent));
    }
    if (!_.isUndefined(inputs.environment)) {
      code += util.format('  environment: %s,\n\n\n', util.inspect(inputs.environment));
    }
    code += util.format('  inputs: {%s\n\n  },\n\n\n', _.reduce(inputs.inputs||{}, function (memo, def, name){
      memo += util.format('\n\n    %s: {%s\n    },', name, _.reduce(def, function (submemo, value, key){
        submemo += util.format('\n      %s: %s,', key, rttc.compile(value));
        return submemo;
      },''));
      return memo;
    }, '')); //util.inspect(inputs.inputs||{}, false, null).replace(/\n/g,'\n\n  '));
    code += util.format('  exits: {%s\n\n  },\n\n\n', _.reduce(inputs.exits||{}, function (memo, def, name){
      memo += util.format('\n\n    %s: {%s\n    },', name, _.reduce(def, function (submemo, value, key){
        if (key == 'getExample') {
          submemo += util.format('\n      getExample: %s,', value.toString());
        } else {
          submemo += util.format('\n      %s: %s,', key, rttc.compile(value));
        }
        return submemo;
      },''));
      return memo;
    }, ''));
    // code += util.format('  exits: %s,\n\n\n', util.inspect(inputs.exits||{success: {}, error: {}}, false, null).replace(/\n/g,'\n\n  '));
    code += util.format('  fn: %s,\n\n\n', fn);
    code += '\n};\n';

    return exits.success(code);

  }
};
