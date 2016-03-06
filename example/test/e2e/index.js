var APP_URL = process.env.APP_URL

module.exports = {
  ' Test home page': function(browser) {
    browser
      .url(APP_URL + '/')

    browser.expect.element('#title').text.to.equal('MicroMono Example').before(3000)

    // Teardown services so istanbul can generate report
    browser.url(APP_URL + '/io/exit')
    browser.url(APP_URL + '/home/exit')
    browser.url(APP_URL + '/account/exit')
    browser.url(APP_URL + '/balancer/exit')
  }
}
