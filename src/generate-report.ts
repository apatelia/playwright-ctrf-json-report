import path from 'path'
import fs from 'fs'

import {
  type Suite,
  type Reporter,
  type TestCase,
  type TestResult,
  type FullConfig,
} from '@playwright/test/reporter'

import {
  type CtrfTestState,
  type CtrfReport,
  type CtrfTest,
  type CtrfEnvironment,
} from '../types/ctrf'

interface ReporterConfigOptions {
  outputFile?: string
  outputDir?: string
  minimal?: boolean
  screenshot?: boolean
  testType?: string
  appName?: string | undefined
  appVersion?: string | undefined
  osPlatform?: string | undefined
  osRelease?: string | undefined
  osVersion?: string | undefined
  buildName?: string | undefined
  buildNumber?: string | undefined
}

class GenerateCtrfReport implements Reporter {
  readonly ctrfReport: CtrfReport
  readonly ctrfEnvironment: CtrfEnvironment
  readonly reporterConfigOptions: ReporterConfigOptions
  readonly reporterName = 'playwright-ctrf-json-reporter'
  readonly defaultOutputFile = 'ctrf-report.json'
  readonly defaultOutputDir = 'ctrf'
  private suite: Suite | undefined
  private startTime: number | undefined

  constructor(config?: Partial<ReporterConfigOptions>) {
    this.reporterConfigOptions = {
      outputFile: config?.outputFile ?? this.defaultOutputFile,
      outputDir: config?.outputDir ?? this.defaultOutputDir,
      minimal: config?.minimal ?? false,
      screenshot: config?.screenshot ?? false,
      testType: config?.testType ?? 'e2e',
      appName: config?.appName ?? undefined,
      appVersion: config?.appVersion ?? undefined,
      osPlatform: config?.osPlatform ?? undefined,
      osRelease: config?.osRelease ?? undefined,
      osVersion: config?.osVersion ?? undefined,
      buildName: config?.buildName ?? undefined,
      buildNumber: config?.buildNumber ?? undefined,
    }

    this.ctrfReport = {
      results: {
        tool: {
          name: 'playwright',
        },
        summary: {
          tests: 0,
          passed: 0,
          failed: 0,
          pending: 0,
          skipped: 0,
          other: 0,
          start: 0,
          stop: 0,
        },
        tests: [],
      },
    }

    this.ctrfEnvironment = {}
  }

  onBegin(_config: FullConfig, suite: Suite): void {
    this.suite = suite
    this.startTime = Date.now()
    this.ctrfReport.results.summary.start = this.startTime

    if (
      !fs.existsSync(
        this.reporterConfigOptions.outputDir ?? this.defaultOutputDir
      )
    ) {
      fs.mkdirSync(
        this.reporterConfigOptions.outputDir ?? this.defaultOutputDir,
        { recursive: true }
      )
    }

    this.setEnvironmentDetails(this.reporterConfigOptions)

    if (this.hasEnvironmentDetails(this.ctrfEnvironment)) {
      this.ctrfReport.results.environment = this.ctrfEnvironment
    }

    this.setFilename(
      this.reporterConfigOptions.outputFile ?? this.defaultOutputFile
    )
  }

  onEnd(): void {
    this.ctrfReport.results.summary.stop = Date.now()

    if (this.suite !== undefined) {
      this.processSuite(this.suite)

      this.ctrfReport.results.summary.suites = this.countSuites(this.suite)
    }
    this.writeReportToFile(this.ctrfReport)
  }

  processSuite(suite: Suite): void {
    for (const test of suite.tests) {
      this.processTest(test)
    }

    for (const childSuite of suite.suites) {
      this.processSuite(childSuite)
    }
  }

  processTest(testCase: TestCase): void {
    const latestResult = testCase.results[testCase.results.length - 1]
    this.updateCtrfTestResultsFromTestResult(
      testCase,
      latestResult,
      this.ctrfReport
    )
    this.updateSummaryFromTestResult(latestResult, this.ctrfReport)
  }

  setFilename(filename: string): void {
    if (filename.endsWith('.json')) {
      this.reporterConfigOptions.outputFile = filename
    } else {
      this.reporterConfigOptions.outputFile = `${filename}.json`
    }
  }

  updateCtrfTestResultsFromTestResult(
    testCase: TestCase,
    testResult: TestResult,
    ctrfReport: CtrfReport
  ): void {
    const test: CtrfTest = {
      name: testCase.title,
      status: this.mapPlaywrightStatusToCtrf(testResult.status),
      duration: testResult.duration,
    }

    if (this.reporterConfigOptions.minimal === false) {
      test.start = this.updateStart(testResult.startTime)
      test.stop = this.calculateStopTime(
        testResult.startTime,
        testResult.duration
      )
      test.message = this.extractFailureDetails(testResult).message
      test.trace = this.extractFailureDetails(testResult).trace
      test.rawStatus = testResult.status
      test.tags = this.extractTagsFromTitle(testCase.title)
      test.type = this.reporterConfigOptions.testType ?? 'e2e'
      test.filePath = testCase.location.file
      test.retry = testResult.retry
      test.flake = testResult.status === 'passed' && testResult.retry > 0
      if (this.reporterConfigOptions.screenshot === true) {
        test.screenshot = this.extractScreenshotBase64(testResult)
      }
      test.suite = this.buildSuitePath(testCase)
      if (
        this.extractMetadata(testResult)?.name !== undefined ||
        this.extractMetadata(testResult)?.version !== undefined
      )
        test.browser = `${this.extractMetadata(testResult)
          ?.name} ${this.extractMetadata(testResult)?.version}`
    }

    ctrfReport.results.tests.push(test)
  }

  updateSummaryFromTestResult(
    testResult: TestResult,
    ctrfReport: CtrfReport
  ): void {
    ctrfReport.results.summary.tests++

    const ctrfStatus = this.mapPlaywrightStatusToCtrf(testResult.status)

    if (ctrfStatus in ctrfReport.results.summary) {
      ctrfReport.results.summary[ctrfStatus]++
    } else {
      ctrfReport.results.summary.other++
    }
  }

  mapPlaywrightStatusToCtrf(testStatus: string): CtrfTestState {
    switch (testStatus) {
      case 'passed':
        return 'passed'
      case 'failed':
      case 'timedOut':
      case 'interrupted':
        return 'failed'
      case 'skipped':
        return 'skipped'
      case 'pending':
        return 'pending'
      default:
        return 'other'
    }
  }

  setEnvironmentDetails(reporterConfigOptions: ReporterConfigOptions): void {
    if (reporterConfigOptions.appName !== undefined) {
      this.ctrfEnvironment.appName = reporterConfigOptions.appName
    }
    if (reporterConfigOptions.appVersion !== undefined) {
      this.ctrfEnvironment.appVersion = reporterConfigOptions.appVersion
    }
    if (reporterConfigOptions.osPlatform !== undefined) {
      this.ctrfEnvironment.osPlatform = reporterConfigOptions.osPlatform
    }
    if (reporterConfigOptions.osRelease !== undefined) {
      this.ctrfEnvironment.osRelease = reporterConfigOptions.osRelease
    }
    if (reporterConfigOptions.osVersion !== undefined) {
      this.ctrfEnvironment.osVersion = reporterConfigOptions.osVersion
    }
    if (reporterConfigOptions.buildName !== undefined) {
      this.ctrfEnvironment.buildName = reporterConfigOptions.buildName
    }
    if (reporterConfigOptions.buildNumber !== undefined) {
      this.ctrfEnvironment.buildNumber = reporterConfigOptions.buildNumber
    }
  }

  hasEnvironmentDetails(environment: CtrfEnvironment): boolean {
    return Object.keys(environment).length > 0
  }

  extractMetadata(testResult: TestResult): any {
    const metadataAttachment = testResult.attachments.find(
      (attachment) => attachment.name === 'metadata.json'
    )
    if (
      metadataAttachment?.body !== null &&
      metadataAttachment?.body !== undefined
    ) {
      try {
        const metadataRaw = metadataAttachment.body.toString('utf-8')
        return JSON.parse(metadataRaw)
      } catch (e) {
        if (e instanceof Error) {
          console.error(`Error parsing browser metadata: ${e.message}`)
        } else {
          console.error('An unknown error occurred in parsing browser metadata')
        }
      }
    }
    return null
  }

  updateStart(startTime: Date): number {
    const date = new Date(startTime)
    const unixEpochTime = Math.floor(date.getTime() / 1000)
    return unixEpochTime
  }

  calculateStopTime(startTime: Date, duration: number): number {
    const startDate = new Date(startTime)
    const stopDate = new Date(startDate.getTime() + duration)
    return Math.floor(stopDate.getTime() / 1000)
  }

  buildSuitePath(test: TestCase): string {
    const pathComponents = []
    let currentSuite: Suite | undefined = test.parent

    while (currentSuite !== undefined) {
      if (currentSuite.title !== '') {
        pathComponents.unshift(currentSuite.title)
      }
      currentSuite = currentSuite.parent
    }

    return pathComponents.join(' > ')
  }

  extractTagsFromTitle(title: string): string[] {
    const tagPattern = /@\w+/g
    const tags = title.match(tagPattern)
    return tags ?? []
  }

  extractScreenshotBase64(testResult: TestResult): string | undefined {
    const screenshotAttachment = testResult.attachments.find(
      (attachment) =>
        attachment.name === 'screenshot' &&
        (attachment.contentType === 'image/jpeg' ||
          attachment.contentType === 'image/png')
    )

    return screenshotAttachment?.body?.toString('base64')
  }

  extractFailureDetails(testResult: TestResult): Partial<CtrfTest> {
    if (testResult.status === 'failed' && testResult.error !== undefined) {
      const failureDetails: Partial<CtrfTest> = {}
      if (testResult.error.message !== undefined) {
        failureDetails.message = testResult.error.message
      }
      if (testResult.error.stack !== undefined) {
        failureDetails.trace = testResult.error.stack
      }
      return failureDetails
    }
    return {}
  }

  countSuites(suite: Suite): number {
    let count = 0

    suite.suites.forEach((childSuite) => {
      count += this.countSuites(childSuite)
    })

    return count
  }

  writeReportToFile(data: CtrfReport): void {
    const filePath = path.join(
      this.reporterConfigOptions.outputDir ?? this.defaultOutputDir,
      this.reporterConfigOptions.outputFile ?? this.defaultOutputFile
    )
    const str = JSON.stringify(data, null, 2)
    try {
      fs.writeFileSync(filePath, str + '\n')
      console.log(
        `${this.reporterName}: successfully written ctrf json to %s`,
        this.reporterConfigOptions.outputFile
      )
    } catch (error) {
      console.error(`Error writing ctrf json report:, ${String(error)}`)
    }
  }
}

export default GenerateCtrfReport
