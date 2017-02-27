var APP_URL = process.env.APP_URL

module.exports = {
  ' Test home page': function(browser) {
    browser
      .url(APP_URL + '/')

    browser.expect.element('#title').text.to.equal('MicroMono Example').before(10000)

    browser
      .url(APP_URL + '/channel')

    browser.expect.element('#sub-title').text.to.equal('MicroMono Channel Example').before(10000)
    browser.pause(8000)

    // Teardown services so istanbul can generate reports
    browser.url(APP_URL + '/io/exit')
    browser.url(APP_URL + '/home/exit')
    browser.url(APP_URL + '/account/exit')
    browser.url(APP_URL + '/channel/exit')
    browser.url(APP_URL + '/balancer/exit')
  }
}
