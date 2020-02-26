[![Codacy Badge](https://api.codacy.com/project/badge/Grade/6e6495428bbd41f0807e4239c42403eb)](https://www.codacy.com/manual/PeterNgTr/codeceptjs-rphelper?utm_source=github.com&amp;utm_medium=referral&amp;utm_content=PeterNgTr/codeceptjs-rphelper&amp;utm_campaign=Badge_Grade) [![npm version](https://badge.fury.io/js/codeceptjs-rphelper.svg)](https://badge.fury.io/js/codeceptjs-rphelper) [![Greenkeeper badge](https://badges.greenkeeper.io/PeterNgTr/codeceptjs-rphelper.svg)](https://greenkeeper.io/)

# codeceptjs-rphelper

This helpes you integrate the test results of CodeceptJS with ReportPortal

`@reportportal/agent-js-codecept` is a [CodeceptJS](https://codecept.io/) plugin which can publish tests results on [ReportPortal](https://reportportal.io/) after execution.

## Installation

```sh
npm i @reportportal/agent-js-codecept --save
```

## Configuration

This plugin should be added in `codecept.conf.js`

Example:

```js
{
  ...
   plugins: {
    reportportal: {
      require: '@reportportal/agent-js-codecept',
      token: 'YOUR_TOKEN',
      endpoint: 'http://localhost:8080/api/v1',
      launchName: 'This is awesome',
      launchDescription: 'This is a description of your launch',
      launchAttributes: [{ key: 'yourKey', value: 'yourValue' }],
      projectName: 'YOUR_PROJECT',
      rerun: false,
      debug: false,
      enabled: true
    }
  ...
}
```

To use this plugin you need to provide the following info:

```sh
- `token`: which can be found by navigating to the user profile page, clicking the username drop-down in the right header and selecting the "Profile" > "UUID" – is a unique user identifier. UUID is used in automated test configuration files for a user authentication instead of a password. It will allow you to post data, without logging it in the UI.
- `endpoint`: your reportportal host + `api/v1` for instance: `http://localhost:8080/api/v1`
- `launchName`: the launch name you want, if not provided, the suite title will be used
- `launchDescription`: the description of your launch, if not provided, the description will be empty
- `launchAttributes`: the attributes of your launch, if not provided, the attributes will be empty
- `projectName`: the project that you created in the reportportal UI
- `debug`: to turn on the debug for reportportal
- `rerun`: to enable rerun
- `rerunOf`: UUID of launch you want to rerun. If not specified, report portal will update the latest launch with the same name
```

About [rerun](https://github.com/reportportal/documentation/blob/master/src/md/src/DevGuides/rerun.md).

Example:
when debug is `true`

```js
Happy Path - Smokecheck --
Start launch 65ndx5jucolqsp
Start test item 65ndx5jucoltbj
Success start item 65ndx5jucoltbj
Save log 65ndx5jucolwu6
Successfully save log 65ndx5jucolwu6
Save log 65ndx5jucolz6k
Successfully save log 65ndx5jucolz6k
Save log 65ndx5jucom2d6
Save log 65ndx5jucom2de
Successfully save log 65ndx5jucom2de
Successfully save log 65ndx5jucom2d6
Save log 65ndx5jucom4q3
Successfully save log 65ndx5jucom4q3
Save log 65ndx5jucomcfx
Save log 65ndx5jucomcg7
Successfully save log 65ndx5jucomcfx
Successfully save log 65ndx5jucomcg7
Save log 65ndx5jucomgbd
Successfully save log 65ndx5jucomgbd
Save log 65ndx5jucomhd8
  ✖ Search a restaurant on restaurant list @test in 6384ms

-- FAILURES:

  1) Happy Path - Smokecheck
       Search a restaurant on restaurant list @test:
     Evaluation failed: DOMException: Failed to execute 'querySelectorAll' on 'Element': '(//input[@id="search-query"])[2]' is not a valid selector.
    at __puppeteer_evaluation_script__:1:33
  
  Scenario Steps:
  
  - I.fillField("(//input[@id="search-query"])[2]", "Web") at Object.searchRestaurant (test/codeceptjs/pages/RestaurantList.js:56:11)
  - I.wait(5) at Object.searchRestaurant (test/codeceptjs/pages/RestaurantList.js:55:11)
  - I.grabTextFrom("span[class="user-address-summary__details__text"]") at Test.Scenario (test/codeceptjs/tests/smokeCheck/happyPath.js:17:37)
  
  
  
  Run with --verbose flag to see NodeJS stacktrace


  FAIL  | 0 passed, 1 failed   // 34s
Successfully save log 65ndx5jucomhd8
Finish test item 65ndx5jucoltbj
Success finish item 65ndx5jucoltbj
Finish launch 65ndx5jucolqsp
Success finish launch 65ndx5jucolqsp
```

## Screenshot

![ReportPortal Test](https://i.ibb.co/Qm52G0n/Screenshot-2019-04-11-at-15-57-40.png)

All the feature tests are now combine in a single launch
![ReportPortal Launch](http://g.recordit.co/GKsRlB4Fi4.gif)

## Notes

Right now, when running with `codeceptjs run`, all tests will be added under a launch. However, if you run with `codeceptjs run-workers no_of_workers`, there will be multiple launches that match `no_of_workers` and all tests will be added under any random launch. One thing you could try right now is trying to use `codeceptjs run-workers --suites no_of_workers`, by that, you won't get the messy results on `reportportal`.

## Debugging Plugin

To debug this plugin run script enabing DEBUG env variable:

```
DEBUG="codeceptjs:reportportal"  npx codeceptjs run
```