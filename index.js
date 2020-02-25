const RPClient = require('reportportal-client');
const fs = require('fs');
const path = require('path');
const util = require('util');
const debug = require('debug')('codeceptjs:reportportal');
const { event, recorder, output, container: Container } = codeceptjs;
// output.level(3);
const helpers = Container.helpers();
let helper;

const rp_FAILED = 'FAILED';
const rp_PASSED = 'PASSED';
const rp_SUITE = 'SUITE';
const rp_TEST = 'TEST';
const rp_STEP = 'STEP';

const supportedHelpers = [
  'Mochawesome',
  'WebDriver',
  'Protractor',
  'Appium',
  'Nightmare',
  'Puppeteer',
  'TestCafe',
  'Playwright'
];

for (const helperName of supportedHelpers) {
  if (Object.keys(helpers).indexOf(helperName) > -1) {
    helper = helpers[helperName];
  }
}

const defaultConfig = {
  token: '',
  endpoint: '',
  project: '',
  launchDescription: '',
  attributes: [],
  debug: false,
  rerun: undefined,
  enabled: false
};

module.exports = (config) => {
  config = Object.assign(defaultConfig, config);

  let launchObj;
  let suiteObj;
  let testObj;
  let fileName;
  let stepInfo;
  let stepObj;
  let rpClient;
  let logFile;
  let suiteStatus = 'PASSED';
  let launchStatus = 'PASSED';
  let currentMetaSteps = [];


  event.dispatcher.on(event.all.before, () => {
    launchObj = startLaunch();
    debug(`${launchObj.tempId}: The launchId is started.`);
  });

  event.dispatcher.on(event.suite.before, (suite) => {
    recorder.add(async () => {
      suiteObj = startTestItem(suite.title, 'SUITE');
      debug(`${suiteObj.tempId}: The suiteId '${suite.title}' is started.`);
      suite.tempId = suiteObj.tempId;
      suiteStatus = 'PASSED';
    });
  });

  event.dispatcher.on(event.test.before, (test) => {
    recorder.add(async () => {
      currentMetaSteps = [];
      stepObj = null;
      testObj = startTestItem(test.title, 'TEST', suiteObj.tempId);
      test.tempId = testObj.tempId;
      debug(`${testObj.tempId}: The testId '${test.title}' is started.`);
    })
  });

  event.dispatcher.on(event.step.before, (step) => {
    recorder.add(async () => {      
      await startMetaSteps(step);
      // const parent = currentMetaSteps.length ? currentMetaSteps[currentMetaSteps.length-1] : testObj;  
      // stepObj = startTestItem(step.toString(), 'STEP', parent.tempId);
      // debug(`${stepObj.tempId}: The stepId is started.`);
    })
  });

  event.dispatcher.on(event.step.after, (step) => {
    recorder.add(() => finishStep(step));
  });

  event.dispatcher.on(event.step.failed, (step, err) => {
    step.err = err;
    for (const metaStep of currentMetaSteps) {
      metaStep.status = 'failed';
    }
  });

  event.dispatcher.on(event.step.passed, (step, err) => {
    for (const metaStep of currentMetaSteps) {
      metaStep.status = 'passed';
    }
  });


  event.dispatcher.on(event.test.failed, (test, err) => {
    launchStatus = 'FAILED';
    suiteStatus = 'FAILED';

    debug(`${test.tempId}: Test '${test.title}' failed.`);
    rpClient.finishTestItem(test.tempId, {
      endTime: test.endTime || rpClient.helpers.now(),
      status: rp_FAILED,
    });    
  });

  event.dispatcher.on(event.test.passed, (test, err) => {
    debug(`${test.tempId}: Test '${test.title}' passed.`);
    rpClient.finishTestItem(test.tempId, {
      endTime: test.endTime || rpClient.helpers.now(),
      status: rp_PASSED,
    });    
  });

  event.dispatcher.on(event.test.after, (test) => {
    recorder.add(async () => {
      await Promise.all(currentMetaSteps.map(m => finishStep(m)));
    });
  });

  event.dispatcher.on(event.suite.after, (suite) => {
    recorder.add(async () => {
      debug(`${suite.tempId}: Suite '${suite.title}' finished ${suiteStatus}.`);
      return rpClient.finishTestItem(suite.tempId, {
        endTime: suite.endTime || rpClient.helpers.now(),
        status: rpStatus(suiteStatus)
      });
    });
  });  

  // event.dispatcher.on(event.all.result, () => {
  //   if (stepInfo) {
  //     rpClient.finishTestItem(suiteObj.tempId, {
  //       endTime: stepInfo.endTime,
  //       status: suiteStatus,
  //     });
  //   } else {
  //     rpClient.finishTestItem(suiteObj.tempId, {
  //       status: 'PASSED',
  //     });
  //   }
  // });


  function startTestItem(testTitle, method, parentId = null) {
    try {
      const hasStats = method !== 'STEP';
      return rpClient.startTestItem({
        name: testTitle,
        type: method,
        hasStats,
      }, launchObj.tempId, parentId);
    } catch (error) {
      output.err(error);
    }

  }


  // close items

  // event.dispatcher.on(event.step.passed, (step) => {
  //   _updateStep(stepObj, step, 'PASSED');
  //   debug(`${stepObj.tempId}: The passed stepId is updated.`);
  // });



  // event.dispatcher.on(event.step.finished, (step) => {
  //   _finishTestItem(launchObj, stepObj, undefined, step.status);
  // });

  // event.dispatcher.on(event.test.passed, (test) => {
  //   launchStatus = 'PASSED';
  //   _updateStep(stepObj, null, 'PASSED');
  // });




  // event.dispatcher.on(event.test.failed, (test, err) => {
  //   launchStatus = 'FAILED';
  //   this.step.err = err;

  //   return rpClient.finishTestItem(test.tempId, {
  //     endTime: step.endTime || rpClient.helpers.now(),
  //     status: rpStatus(test.status),
  //   });    
  //   // _updateStep(stepObj, this.step, 'FAILED');
  //   debug(`${stepObj.tempId}: The failed stepId is updated.`);
  // });

  // event.dispatcher.on(event.test.finished, (test) => {
  //   finishTestItem(launchObj, testObj, undefined, test.state);
  // });

  event.dispatcher.on(event.all.result, () => {
    recorder.add(async () => {
      await suiteObj.promise;
      await rpClient.finishTestItem(suiteObj.tempId, {
        status: suiteStatus,
      }).promise;
      finishLaunch();
    });
      // suiteObj.promise.then(() => {
      //   rpClient.finishTestItem(suiteObj.tempId, {
      //     status: 'PASSED',
      //   });
      // });


  });

  function startLaunch(suiteTitle) {
    rpClient = new RPClient({
      token: config.token,
      endpoint: config.endpoint,
      project: config.projectName,
      debug: config.debug,
    });

    return rpClient.startLaunch({
      name: config.launchName || suiteTitle,
      description: config.launchDescription,
      attributes: config.launchAttributes,
      rerun: config.rerun,
      rerunOf: config.rerunOf,
    });
  }


  // function _finishTestItem(launchObj, itemObject, step, status) {
  //   if (status === 'success') {
  //     status = 'PASSED'
  //   };

  //   if (step) {
  //     if (status === 'FAILED') {
  //       if (helper) {
  //         fileName = `${rpClient.helpers.now()}_failed.png`;
  //         logFile = `${rpClient.helpers.now()}_browser.logs.txt`;
  //         helper.saveScreenshot(fileName).then(() => {
  //           try {
  //             rpClient.sendLog(itemObject.tempId, {
  //               level: 'error',
  //               message: `[FAILED STEP] ${step.toString()} due to ${step.err}`,
  //               time: step.startTime,
  //             }, {
  //               name: fileName,
  //               type: 'image/png',
  //               content: fs.readFileSync(path.join(global.output_dir, fileName)),
  //             });
  
  //             fs.unlinkSync(path.join(global.output_dir, fileName));
  //             debug('Screenshot is attached to failed step');
  //           } catch (error) {
  //             output.error(error);
  //           }

  //           helper.grabBrowserLogs().then((browserLogs) => {
  //             fs.writeFileSync(path.join(global.output_dir, logFile), util.inspect(browserLogs));
  
  //             rpClient.sendLog(itemObject.tempId, {
  //               level: 'trace',
  //               message: `[BROWSER LOGS FOR FAILED STEP] ${step.toString()} due to ${step.err}`,
  //               time: step.startTime,
  //             }, {
  //               name: logFile,
  //               type: 'text/plain',
  //               content: fs.readFileSync(path.join(global.output_dir, logFile)),
  //             });
  
  //             fs.unlinkSync(path.join(global.output_dir, logFile));
  //           });
  //         });
  //       }
  //     }

  //     rpClient.finishTestItem(itemObject.tempId, {
  //       endTime: step.endTime || rpClient.helpers.now(),
  //       status,
  //     });
  //   } else {
  //     try {
  //       rpClient.finishTestItem(itemObject.tempId, {
  //         status,
  //       });
  //     } catch (error) {
  //       output.err(error);
  //     }
  //   }
  // }

  function finishLaunch() {
    try {
      debug(`${launchObj.tempId} Finished launch: ${launchStatus}`)
      return rpClient.finishLaunch(launchObj.tempId, {
        status: launchStatus,
      });
    } catch (error) {
      debug(error);
    }

  }

  async function startMetaSteps(step) {
    let metaStepObj = {};
    const metaSteps = metaStepsToArray(step);

    for (const i in metaSteps) {
      const metaStep = metaSteps[i];
      if (isEqualMetaStep(metaStep, currentMetaSteps[i])) {
        continue;
      } 
      // close current metasteps
      for (let j = i; j < currentMetaSteps.length; j++) {
        await finishStep(currentMetaSteps[j]);
        delete currentMetaSteps[j];
      }
      metaStepObj = startTestItem(metaStep.toString(), rp_STEP, metaStepObj.tempId || testObj.tempId);
      metaStep.tempId = metaStepObj.tempId;
      debug(`${metaStep.tempId}: The stepId '${step.title}' is started.`);
    }

    currentMetaSteps = metaSteps;
  }

  function finishStep(step) {
    if (!step) return;

    return rpClient.finishTestItem(step.tempId, {
      endTime: step.endTime || rpClient.helpers.now(),
      status: rpStatus(step.status),
    });
  }


  return this;
};

function metaStepsToArray(step) {
  let metaSteps = [];
  iterateMetaSteps(step, metaStep => metaSteps.push(metaStep));
  return metaSteps;
}

function iterateMetaSteps(step, fn) {
  if (step.metaStep) iterateMetaSteps(step.metaStep, fn);
  if (step) fn(step);
}


const isEqualMetaStep = (metastep1, metastep2) => {
  if (!metastep1 && !metastep2) return true;
  if (!metastep1 || !metastep2) return false;
  return metastep1.actor === metastep2.actor 
    && metastep1.name === metastep2.name 
    && metastep1.args.join(',') === metastep2.args.join(',');
};


function rpStatus(status) {
  if (status === 'success') return rp_PASSED;
  if (status === 'failed') return rp_FAILED;
  return status;
}
