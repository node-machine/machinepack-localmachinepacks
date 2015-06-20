module.exports = {

  friendlyName: 'Prompt for input values',

  description: 'Prompt command-line user for the specified machine input values.',

  inputs: {
    prompts: {
      description: 'An array of prompt objects this machine will use to properly prompt for and validate user-defined values for runtime inputs.',
      extendedDescription: '`expectType` may be "string" or "password".  If it is "password", the relevant prompt will not display typed characters.',
      example: [{
        name: 'foobar',
        example: 'here is what a foobar should look like',
        typeclass: 'dictionary',
        description: 'The foobar that will be used to foo the bar (i.e. input description)',
        expectType: 'json'
      }]
    }
  },

  exits: {
    error: {
      description: 'Unexpected error occurred.',
    },
    success: {
      description: 'Done.',
      example: [{
        name: 'foobar',
        value: 'stuff and things'
      }]
    }
  },

  fn: function (inputs, exits){

    /**
     * Module dependencies
     */

    var inquirer = require('inquirer');
    var chalk = require('chalk');
    var _ = require('lodash');
    var Path = require('path');
    var util = require('util');


    // Build array of prompt objects for inquirer
    var promptArray;
    try {
      promptArray = _.reduce(inputs.prompts, function (memo, promptDef){
        var inquirerPromptDef = {
          name: promptDef.name,
          message: (
            ( promptDef.description ? chalk.reset('Please enter '+promptDef.description[0].toLowerCase()+promptDef.description.slice(1))
              : chalk.reset('Please enter a value for ')+chalk.bold(promptDef.name)
            ) +'\n'+
            chalk.bold(promptDef.name)+': '
          ),
            // chalk.reset(chalk.gray(promptDef.description?'  '+(promptDef.description[0].toLowerCase()+promptDef.description.slice(1))+'':''))+'\n'+chalk.bold(promptDef.name)+': ',
          // message: util.format(chalk.reset('Please enter a value for ')+'%s', chalk.bold(promptDef.name) + chalk.reset(chalk.gray(promptDef.description?'  '+(promptDef.description[0].toLowerCase()+promptDef.description.slice(1))+'':''))+'\n'+chalk.bold(promptDef.name)+': '),
          // message: util.format('%s', promptDef.name, chalk.reset(chalk.gray(promptDef.description?', '+(promptDef.description[0].toLowerCase()+promptDef.description.slice(1))+'':'')), (promptDef.example?('\n(e.g. '+promptDef.example+')'):''),'\n?'),
          // message: util.format('Please enter a value for "%s"', promptDef.name, chalk.reset(chalk.gray(promptDef.description?', '+(promptDef.description[0].toLowerCase()+promptDef.description.slice(1))+'':'')), '\n?'),
          type: (function (){
            if (promptDef.expectType === 'string') {
              return 'input';
            }
            if (promptDef.expectType === 'password') {
              return 'password';
            }
            if (promptDef.expectType === 'json') {
              return 'input';
            }
            throw new Error('Unexpected `expectType` for prompt: '+promptDef.expectType);
          })(),
          validate: function _isTruthy(value){
            var parsedValue;
            // Value is truthy
            if (value) {
              if (promptDef.expectType === 'json'){
                try {
                  // TODO: use `rttc.parseHuman()` here
                  parsedValue = JSON.parse(value);
                  // Don't allow null
                  if (_.isNull(parsedValue)) {
                    return '`null` is not allowed, sorry';
                  }
                  // Allow booleans, strings, numbers, objects, arrays
                  return true;
                }
                catch (e){}
                return 'enter valid JSON (don\'t forget double quotes!)';
              }
              return true;
            }

            // Value is falsy
            else {
              if (promptDef.example) {
                return 'e.g. '+promptDef.example;
              }
              return false;
            }
          }
        };
        // if (promptDef.example){
        //   inquirerPromptDef.default = promptDef.example;
        // }
        memo.push(inquirerPromptDef);
        return memo;
      }, []);
    }
    catch (e) {
      return exits.error(e);
    }


    inquirer.prompt(promptArray, function (answers) {
      var resultArray = [];
      try {
        _.each(answers, function (answer, key){
          resultArray.push({
            name: key,
            value: answer
          });
        });
      }
      catch (e) {
        return exits.error(e);
      }
      return exits.success(resultArray);
    });
  }
};
