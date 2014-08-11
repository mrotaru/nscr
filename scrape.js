var request = require('request');
var fs = require('fs');

var spider_path = ('./spiders');

//var proxy = "http://127.0.0.1:8888"; // will be used by Request

var spider_name =process.argv[2];
var extractLinks = 2; // by default, extract 2 more links to be parsed

function Scraper(spider_name) {
    this.init(spider_name);
    this._scrapedLinks = 0;
}

Scraper.prototype.init = function(spider_name) {
    var Spider = null;
    // try to load spider from local dir
    var localPath = spider_path + '/' + spider_name;
    if(fs.existsSync(localPath)) {
        Spider = require(localPath);
    } else {
        Spider = require('./node_modules/' + spider_name + '-spider');
    }
    this.spider = new Spider();
    this.start_url = typeof this.spider.start_url == 'undefined' ? 'http://www.' + this.spider.name : this.spider.start_url;
}

Scraper.prototype.scrape = function(url){
    var url = typeof url == 'undefined' ? this.start_url : url;
    var done = false;
    while(!done) {
        console.log('scraping: ', url);   
        this._scrapedLinks++;
        if(typeof this.spider.more == 'function' && this._scrapedLinks < extractLinks ) {
            scrape(this.spider.more());
        } else {
            done = true;
        }
    }
}

// returns a promise
Scraper.prototype._scrape = function(url){
    if(this.spider.phantom) {
        this._phantomScrape(url);
    } else {
        this._requestScrape(url);
    }
}

// promisify
Scraper.prototype._phantomScrape = function(url){
    var self = this;
    var _phantom = require("phantom");
    _phantom.create(function(phantom){
        if(!phantom) {
            console.log('phantom create failed');
        } else {
            phantom.createPage(function(page){
                page.open(url, function(status){
                    if(status == 'success') {
                        page.evaluate(function(){
                                return document;
                            }, function (result) {
                                var html = result.all[0].innerHTML;
                                phantom.exit();
                                self.spider.parse(html);
                        })
                    } else {
                        console.log("error: page could not be opened");
                    }
                })
            });
        }
    });
}

// promisify
Scraper.prototype._requestScrape = function(url){

    var request_options = {};
    request_options.uri = url;
    request_options.proxy = typeof proxy != 'undefined' ? proxy : null;

    var self = this;
    request(
        request_options,
        function(err, resp, body) {
           if (!err && resp.statusCode == 200) {
                self.spider.parse(body);
            }
        }
    )
}

var scraper = new Scraper(spider_name);
scraper.spider.on("item-scraped", function(item){
    console.log(item.title);
});
scraper.scrape();
