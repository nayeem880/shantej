//jshint esversion:6
require('dotenv').config()
const bodyParser = require("body-parser");
const connectEnsureLogin = require('connect-ensure-login');
const csvtojson = require("csvtojson");
const express = require("express");
const expressSession = require('express-session')({
  secret: 'secret',
  resave: false,
  saveUninitialized: false
});
const http = require('http'); // for debugging scrapyd with localhost
const https = require('https');
const LocalStrategy = require("passport-local")
const mongoose = require("mongoose");
const multer = require('multer');
const nodemailer = require('nodemailer');
const path = require('path');
const passport = require('passport');
const passportLocalMongoose = require('passport-local-mongoose');
const querystring = require('querystring');
const _ = require("lodash");


const fs = require('fs');
const readline = require('readline');
const {google} = require('googleapis');
const SCOPES = ['https://www.googleapis.com/auth/gmail.send'];

const TOKEN_PATH = '.env.json';
const open = require('open');


const upload = multer({
  storage: multer.memoryStorage()
});

const app = express();

app.set('view engine', 'ejs');

app.use(bodyParser.urlencoded({
  limit: '5mb',
  extended: true
}));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));
app.use(expressSession);
app.use(passport.initialize());
app.use(passport.session());

//DEVELOPMENT ENV DB INFO
// const dbUri = "mongodb+srv://admin-amit:test1234@cluster0-thgjr.mongodb.net/scraper_db";
const dbUri = "mongodb://localhost:27017/scraper_db"

// PRODUCTION DB INFO
// mongodb+srv://admin-santhej:<password>@cluster0.3dv1a.mongodb.net/<dbname>?retryWrites=true&w=majority
// const dbUri = "mongodb+srv://admin-santhej:test1234@cluster0.3dv1a.mongodb.net/scraper_db";
mongoose
  .connect(dbUri, {
    useNewUrlParser: true,
    useCreateIndex: true,
    useUnifiedTopology: true
  })
  .then(() => console.log('Successfully connected to email_db'))
  .catch(err => console.log(err));

const urlShema = {
  website_url: String,
  base_url: String,
  category: String,
  report_title: String
}
const Url = mongoose.model("Url", urlShema);

const emailShema = {
  categoty: String,
  cf: String,
  da: String,
  date: String,
  email: String,
  pa: String,
  report_title: String,
  snov_io: String,
  tf: String,
  url: String,
  website: String,
}
const Email = mongoose.model("Email", emailShema);

const uploadedCsvShema = {
  website_url: String,
  category: String,
  report_title: String
}
const UploadedCsv = mongoose.model("UploadedCsv", uploadedCsvShema);

const templateShema = {
  template_name: String,
  template_subject: String,
  template_body: String
}
const Template = mongoose.model("Template", templateShema);

const userSchema = new mongoose.Schema({
  username: String,
  password: String,
  first_name: String,
  last_name: String,
  active: Boolean
});
userSchema.plugin(passportLocalMongoose);
const User = mongoose.model("User", userSchema);

function deleteUploadedCsvRecords() {
  UploadedCsv.remove({})
    .then(() => console.log('Successfully deleted all records from UploadedCsvs'))
    .catch(err => console.log(err));
}



/* PASSPORT LOCAL AUTHENTICATION */
// passport.use(User.createStrategy());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());




// BASE ROUTE
app.get("/get", function (req, res) {
  res.render("home", {
    pageTitle: 'Home',
    // token: req.query.code
  });
});


// app.get("/", connectEnsureLogin.ensureLoggedIn('/login'),
//   function (req, res) {
//     res.render("home", {
//       pageTitle: 'Home'
//     });
//   });

// LOGIN ROUTE
app.get('/login', function (req, res) {
  res.render('login');
});

app.post('/login', (req, res, next) => {
  passport.authenticate('local',
    (err, user, info) => {
      if (err) {
        return next(err);
      }

      if (!user) {
        return res.redirect('/login?info=' + info);
      }

      req.logIn(user, function (err) {
        if (err) {
          return next(err);
        }

        return res.redirect('/');
      });
    })(req, res, next);
});

/* REGISTRATION ROUTE*/
// app.post('/signup', function (req, res) {
//   console.log(req.body);
//   User.register({
//       username: req.body.email,
//       password: req.body.password,
//       first_name: req.body.first_name,
//       last_name: req.body.last_name,
//       active: false
//     },
//     'password',
//     function (err, user) {
//       if (err) {
//         console.log(err);
//       } else {
//         let authenticate = User.authenticate();
//         authenticate('username', 'password', function (err, result) {
//           if (err) {
//             console.log(err);
//           }
//           if (!result) {
//             console.log('User registration failed');
//           } else {
//             res.redirect('/');
//           }
//         })
//       }
//     }
//   );
// });

app.post('/signup', function (req, res) {
  let username = req.body.username;
  let password = req.body.password;
  let first_name = req.body.first_name;
  let last_name = req.body.last_name;
  User.register(new User({ username: username, first_name: first_name, last_name: last_name }), 
          password, function (err, user) { 
      if (err) { 
          console.log(err); 
          return res.render("register"); 
      } 

      passport.authenticate("local")( 
          req, res, function () { 
          res.render("/login");
      }); 
  }); 
});

/* REGISTRATION ROUTE*/

















































// ----------------- BEGIN /run-spider PRODUCTION CODE ----------------//
app.post("/run-spider", upload.single('csv_file_name'), function (req, res) {
  // Delete previous user uploaded URL records
  deleteUploadedCsvRecords();

  console.log(req.body);
  const project = req.body.project;
  console.log("INFO: project - " + project)
  const spider = req.body.spider;
  console.log("INFO: spider - " + spider)
  const custom_report_title = req.body.report_title;
  console.log("INFO: custom report title - " + custom_report_title)
  const report_title = custom_report_title ? custom_report_title : req.body.keywords
  console.log('Report Title -> ' + report_title);

  let data = {};
  let options = {
    // host: 'kallada-scrapers.herokuapp.com',
    host: 'localhost',
    // port: 443,
    port: 6800,
    method: 'POST',
    path: '/schedule.json',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    }
  };
  // const list_jobs_url = 'https://kallada-scrapers.herokuapp.com/listjobs.json?project=extract_emails'
  const list_jobs_url = 'http://localhost:6800/listjobs.json?project=extract_emails'
  console.log('Job list url - ' + list_jobs_url);

  if (spider === "guestpostscraper_and_get_emails") {
    // Call guestpostscraper spider first
    const keywords = req.body.keywords
    data = querystring.stringify({
      'project': project,
      'spider': 'guestpostscraper',
      'seed_keywords': keywords,
      'report_title': report_title
    });
    console.log(data);
    options['headers']['Content-Length'] = Buffer.byteLength(data);
    console.log(options);
    // let reqst = https.request(options, (resp) => {
    let reqst = http.request(options, (resp) => {
      console.log(`statusCode: ${resp.statusCode}`)
      resp.on('data', (d) => {
        console.log('RESPONSE DATA FOUND')
        console.log(d.toString('utf8'));
        if ("jobid" in JSON.parse(d.toString('utf8'))) {
          let job_id = JSON.parse(d.toString('utf8')).jobid;
          console.log(`Job id found - ${job_id}`);
          if (job_id) {
            // define a time variable
            let timer;

            // function to stop the timer and trigger get_emails spider
            function stopTimer() {
              console.log('Stoping interval loop');
              clearInterval(timer);
              console.log('Triggering get_emails spider');

              // Trigger get_emails spider
              data = querystring.stringify({
                'project': project,
                'spider': 'get_emails',
                'use_db': 'true',
                'use_csv': 'false',
                'report_title': report_title
              });
              console.log(data);
              options['headers']['Content-Length'] = Buffer.byteLength(data);
              console.log(options);
              // const reqst = https.request(options, response => {
              const reqst = http.request(options, response => {
                console.log(`statusCode: ${response.statusCode}`);
                let str = ''
                response.on('data', function (chunk) {
                  str += chunk;
                });

                response.on('end', function () {
                  console.log(str);
                });
              });

              reqst.write(data)
              reqst.end()
            }

            // Function to check status of guestpostscrapper job
            function checkJobStatus() {
              // https.get(list_jobs_url, (res) => {
              http.get(list_jobs_url, (res) => {
                const {
                  statusCode
                } = res;
                if (statusCode !== 200) {
                  console.error('Request Failed.\n' +
                    `Status Code: ${statusCode}`);
                  res.resume();
                  return;
                } else {
                  console.log(`Status Code: ${statusCode}`);
                }
                res.on('data', (jobs) => {
                  let jobs_info = JSON.parse(jobs.toString('utf8'));
                  jobs_info.finished.forEach((job) => {
                    console.log(`Job ids ->   ${job.id}   ${job_id}`);
                    if (job.id == job_id) {
                      console.log(`Job ${job_id} completed`);
                      stopTimer(timer);
                    } else {
                      console.log(`Job ${job_id} not completed. Recheck in 10 seconds`);
                    }
                  });
                });
                res.on('end', () => {
                  console.log('Listjobs request completed');
                });
              }).on('error', (e) => {
                console.error(`Got error: ${e.message}`);
              })
            }
            timer = setInterval(checkJobStatus, 10000);
          }
          res.redirect('/');
        } else {
          console.error('Looks like job was not triggered');
        }
      });
    });
    reqst.on('error', (error) => {
      console.log('ERROR OCCURED')
      console.error(error)
    });
    reqst.write(data)
    reqst.end()
  } else if (spider === "guestpostscraper") {
    const keywords = req.body.keywords
    data = querystring.stringify({
      'project': project,
      'spider': spider,
      'seed_keywords': keywords
    });
    console.log(data);
    options['headers']['Content-Length'] = Buffer.byteLength(data);
    console.log(options);
    // let reqst = https.request(options, (resp) => {
    let reqst = http.request(options, (resp) => {
      console.log(`statusCode: ${resp.statusCode}`)
      resp.on('data', (d) => {
        console.log('RESPONSE DATA FOUND')
        process.stdout.write(d)
      });
      res.redirect('/');
    });
    reqst.on('error', (error) => {
      console.log('ERROR OCCURED')
      console.error(error)
    });
    reqst.write(data)
    reqst.end()
  } else {
    const checkbox = req.body.upload_csv_checkbox;
    console.log('INFO: checkbox - ' + checkbox);
    if (checkbox) {
      const csvData = req.file.buffer.toString('utf8');
      const report_title = req.body.report_title;
      console.log('INFO: report_title - ' + report_title);
      csvtojson().fromString(csvData)
        .then(jsonData => {
          jsonData.forEach(jdata => {
            // console.log(data);
            UploadedCsv.insertMany({
              'website_url': jdata['website_url'],
              'category': report_title,
              'report_title': report_title
            });
            Url.insertMany({
              'website_url': jdata['website_url'],
              'category': report_title,
              'report_title': report_title,
              'base_url': 'NA'
            });
          });

          data = querystring.stringify({
            'project': project,
            'spider': spider,
            'use_db': 'true',
            'report_title': report_title
          });
          console.log(data);
          options['headers']['Content-Length'] = Buffer.byteLength(data);
          console.log(options);
          // const reqst = https.request(options, (resp) => {
          const reqst = http.request(options, (resp) => {
            console.log(`statusCode: ${resp.statusCode}`)
            resp.on('data', (d) => {
              console.log('RESPONSE DATA FOUND')
              process.stdout.write(d)
            });
            res.redirect('/');
          });
          reqst.on('error', (error) => {
            console.log('ERROR OCCURED')
            console.error(error)
          });
          reqst.write(data)
          reqst.end()
        })
        .catch(err => console.log(err));
    } else {
      data = querystring.stringify({
        'project': project,
        'spider': spider
      });
      console.log(data);
      options['headers']['Content-Length'] = Buffer.byteLength(data);
      console.log(options);
      // const reqst = https.request(options, (resp) => {
      const reqst = http.request(options, (resp) => {
        console.log(`statusCode: ${resp.statusCode}`)
        resp.on('data', (d) => {
          console.log('RESPONSE DATA FOUND')
          process.stdout.write(d)
        });
        res.redirect('/');
      });
      reqst.on('error', (error) => {
        console.log('ERROR OCCURED')
        console.error(error)
      });
      reqst.write(data)
      reqst.end()
    }
  }
});
// ----------------- END RUN-SPIDER PRODUCTION CODE ----------------//







































// ----------------- BEGIN /run-spider DEVELOPMENT CODE ----------------//
// app.post("/run-spider", upload.single('csv_file_name'), function (req, res) {
//   // Delete previous user uploaded URL records
//   deleteUploadedCsvRecords();

//   console.log(req.body);
//   const project = req.body.project;
//   console.log("INFO: project - " + project)
//   const spider = req.body.spider;
//   console.log("INFO: spider - " + spider)
//   const custom_report_title = req.body.report_title;
//   console.log("INFO: custom report title - " + custom_report_title)

//   let data = {};
//   let options = {
//     host: 'localhost',
//     port: 6800,
//     method: 'POST',
//     path: '/schedule.json',
//     headers: {
//       'Content-Type': 'application/x-www-form-urlencoded',
//     }
//   };
//   const list_jobs_url = 'http://localhost:6800/listjobs.json?project=extract_emails'
//   console.log('Job list url - ' + list_jobs_url);

//   if (spider === "guestpostscraper_and_get_emails") {
//     // Call guestpostscraper spider first
//     const keywords = req.body.keywords
//     const report_title = custom_report_title ? custom_report_title : keywords
//     console.log('DEBUG: Report Title -> ' + report_title);
//     data = querystring.stringify({
//       'project': project,
//       'spider': 'guestpostscraper',
//       'seed_keywords': keywords,
//       'report_title': report_title
//     });
//     console.log(data);
//     options['headers']['Content-Length'] = Buffer.byteLength(data);
//     console.log(options);
//     let reqst = http.request(options, (resp) => {
//       console.log(`statusCode: ${resp.statusCode}`)
//       resp.on('data', (d) => {
//         console.log('RESPONSE DATA FOUND')
//         console.log(d.toString('utf8'));
//         if ("jobid" in JSON.parse(d.toString('utf8'))) {
//           let job_id = JSON.parse(d.toString('utf8')).jobid;
//           console.log(`Job id found - ${job_id}`);
//           if (job_id) {
//             // define a time variable
//             let timer;

//             // function to stop the timer and trigger get_emails spider
//             function stopTimer() {
//               console.log('Stoping interval loop');
//               clearInterval(timer);
//               console.log('Triggering get_emails spider');

//               // Trigger get_emails spider
//               data = querystring.stringify({
//                 'project': project,
//                 'spider': 'get_emails',
//                 'use_db': 'true',
//                 'use_csv': 'false',
//                 // 'report_title': keywords,
//                 'report_title': report_title
//               });
//               console.log(data);
//               options['headers']['Content-Length'] = Buffer.byteLength(data);
//               console.log(options);
//               const reqst = http.request(options, response => {
//                 console.log(`statusCode: ${response.statusCode}`);
//                 let str = ''
//                 response.on('data', function (chunk) {
//                   str += chunk;
//                 });

//                 response.on('end', function () {
//                   console.log(str);
//                 });
//               });

//               reqst.write(data)
//               reqst.end()
//             }

//             // Function to check status of guestpostscrapper job
//             function checkJobStatus() {
//               http.get(list_jobs_url, (res) => {
//                 const {
//                   statusCode
//                 } = res;
//                 if (statusCode !== 200) {
//                   console.error('Request Failed.\n' +
//                     `Status Code: ${statusCode}`);
//                   res.resume();
//                   return;
//                 } else {
//                   console.log(`Status Code: ${statusCode}`);
//                 }
//                 res.on('data', (jobs) => {
//                   let jobs_info = JSON.parse(jobs.toString('utf8'));
//                   jobs_info.finished.forEach((job) => {
//                     console.log(`Job ids ->   ${job.id}   ${job_id}`);
//                     if (job.id == job_id) {
//                       console.log(`Job ${job_id} completed`);
//                       stopTimer(timer);
//                     } else {
//                       console.log(`Job ${job_id} not completed. Recheck in 10 seconds`);
//                     }
//                   });
//                 });
//                 res.on('end', () => {
//                   console.log('Listjobs request completed');
//                 });
//               }).on('error', (e) => {
//                 console.error(`Got error: ${e.message}`);
//               })
//             }
//             timer = setInterval(checkJobStatus, 10000);
//           }
//           res.redirect('/');
//         } else {
//           console.error('Looks like job was not triggered');
//         }
//       });
//     });
//     reqst.on('error', (error) => {
//       console.log('ERROR OCCURED')
//       console.error(error)
//     });
//     reqst.write(data)
//     reqst.end()

//   } else if (spider === "guestpostscraper") {
//     const keywords = req.body.keywords
//     data = querystring.stringify({
//       'project': project,
//       'spider': spider,
//       'seed_keywords': keywords
//     });
//     console.log(data);
//     options['headers']['Content-Length'] = Buffer.byteLength(data);
//     console.log(options);
//     const reqst = http.request(options, response => {
//       console.log(`statusCode: ${response.statusCode}`);
//       let str = ''
//       response.on('data', function (chunk) {
//         str += chunk;
//       });

//       response.on('end', function () {
//         console.log(str);
//         res.redirect('/')
//       });
//     });

//     reqst.write(data)
//     reqst.end()
//   } else {
//     const checkbox = req.body.upload_csv_checkbox;
//     console.log('INFO: checkbox - ' + checkbox);
//     if (checkbox) {
//       const csvData = req.file.buffer.toString('utf8');
//       const report_title = req.body.report_title;
//       console.log('INFO: report_title - ' + report_title);
//       csvtojson().fromString(csvData)
//         .then(jsonData => {
//           jsonData.forEach(jdata => {
//             // console.log(data);
//             // UploadedCsv.insertMany(jdata);
//             UploadedCsv.insertMany({
//               'website_url': jdata['website_url'],
//               'category': report_title,
//               'report_title': report_title
//             });
//             Url.insertMany({
//               'website_url': jdata['website_url'],
//               'category': report_title,
//               'report_title': report_title,
//               'base_url': 'NA'
//             });
//           });

//           data = querystring.stringify({
//             'project': project,
//             'spider': spider,
//             'use_db': 'true',
//             'report_title': report_title
//           });
//           console.log(data);
//           options['headers']['Content-Length'] = Buffer.byteLength(data);
//           console.log(options);
//           const reqst = http.request(options, response => {
//             console.log(`statusCode: ${response.statusCode}`);
//             let str = ''
//             response.on('data', function (chunk) {
//               str += chunk;
//             });

//             response.on('end', function () {
//               console.log(str);
//               res.redirect('/')
//             });
//           });

//           reqst.write(data)
//           reqst.end()
//         })
//         .catch(err => console.log(err));
//     } else {
//       data = querystring.stringify({
//         'project': project,
//         'spider': spider
//       });
//       console.log(data);
//       options['headers']['Content-Length'] = Buffer.byteLength(data);
//       console.log(options);
//       const reqst = http.request(options, response => {
//         console.log(`statusCode: ${response.statusCode}`);
//         let str = ''
//         response.on('data', function (chunk) {
//           str += chunk;
//         });

//         response.on('end', function () {
//           console.log(str);
//           res.redirect('/')
//         });
//       });

//       reqst.write(data)
//       reqst.end()
//     }
//   }
// });
// ----------------- END RUN-SPIDER DEVELOPMENT CODE ----------------//


// ----------------- BEGIN /reports PRODUCTION CODE  ------------------//
// --- For displaying reports based on individual keywords ---//
app.get("/reports", function (req, res) {
  Url.distinct('category', function (error, urls) {
    if (error) {
      console.log(error);
    } else {
      console.log('/reports - Successfully retrieved all categories from scaper_db.urls');
      console.log(urls);
      Template.find({}, function (err, templates) {
        if (err) {
          console.log(err);
        } else {
          console.log('/reports - Successfully retrieved all templates from scaper_db.templates');
          // console.log(templates);
          res.render("reports", {
            pageTitle: 'Reports Based On Individual Keyword',
            categories: urls,
            templates: templates
          });
        }
      });
    }
  })
});

app.get("/reports/:category", function (req, res) {
  const category = req.params.category;
  console.log('category - ' + category);
  let pageTitle = _.replace(category, '_', ' ')
  pageTitle = _.capitalize(pageTitle)
  Email.find({
    'category': category
  }, function (error, emails) {
    if (error) {
      console.log(error);
    } else {
      Email.find({
        category: category
      }, function (error, emails) {
        if (error) {
          console.log(error);
        } else {
          console.log('/reports/:category - Successfully retrieved email data based on category from scaper_db.emails');
          console.log(emails); //uncomment for debugging
          Template.find({}, function (err, templates) {
            if (err) {
              console.log(err);
            } else {
              console.log('/view - Successfully retrieved all templates from scaper_db.templates');
              console.log(templates);
              res.render("emails", {
                pageTitle: 'Data for - ' + pageTitle,
                emailItems: emails,
                templates: templates
              });
            }
          });
        }
      });
    }
  });
});

app.post("/reports/:category", function (req, res) {
  const category = req.params.category;
  console.log('Category to delete - ' + category);
  Url.deleteMany({
    'category': category
  }, function (error) {
    if (error) {
      console.log(error);
    } else {
      console.log('/reports/:category - Successfully deleted category from scaper_db.emails');
      res.redirect('/reports');
    }
  });
});

// ------------------ END /reports PRODUCTION CODE  -------------------//


// ----------------- BEGIN /view PRODUCTION CODE  ------------------//
// ----- For displaying reports based on keyword combos- -----//
app.get("/view", function (req, res) {
  Url.distinct('report_title', function (error, keyword_combos) {
    if (error) {
      console.log(error);
    } else {
      console.log('/view - Successfully retrieved all report titles from scaper_db.urls');
      // console.log(keyword_combos);
      Template.find({}, function (err, templates) {
        if (err) {
          console.log(err);
        } else {
          console.log('/view - Successfully retrieved all templates from scaper_db.templates');
          // console.log(templates);
          res.render("urls", {
            pageTitle: 'Reports Based on Keyword Combinations (as given by user)',
            categories: keyword_combos,
            templates: templates
          });
        }
      });
    }
  })
});

app.get("/view/:keywordCombo", function (req, res) {
  const keywordCombo = req.params.keywordCombo;
  console.log('Keyword Combo - ' + keywordCombo);
  let pageTitle = _.replace(keywordCombo, '_', ' ')
  pageTitle = _.capitalize(pageTitle)
  Email.find({
    'report_title': keywordCombo
  }, function (error, emails) {
    if (error) {
      console.log(error);
    } else {
      console.log(emails);
      console.log('/view/:keywordCombo - Successfully retrieved email data based on report_title from scaper_db.emails');
      Template.find({}, function (err, templates) {
        if (err) {
          console.log(err);
        } else {
          console.log('/view - Successfully retrieved all templates from scaper_db.templates');
          console.log(templates);
          res.render("emails", {
            pageTitle: 'Data for - ' + pageTitle,
            emailItems: emails,
            templates: templates
          });
        }
      });
    }
  });
});

app.post("/view/:category", function (req, res) {
  const category = req.params.category;
  console.log('Category to delete - ' + category);
  Url.deleteMany({
    'report_title': category
  }, function (error) {
    if (error) {
      console.log(error);
    } else {
      console.log('/view/:category - Successfully deleted category from scaper_db.emails');
      res.redirect('/view');
    }
  });
});

// ----------------- END /view PRODUCTION CODE  ------------------//

// ----------------- BEGIN OF /emails/delete/<%= emailItem._id %> CODE  ------------------//
app.post("/reports/delete/:recordId", function (req, res) {
  const recordId = req.params.recordId;
  console.log('Record Id to delete - ' + recordId);
  Email.deleteOne({
    '_id': recordId
  }, function (error) {
    if (error) {
      console.log(error);
    } else {
      console.log('/emails/delete/:recordId - Successfully deleted record id ' + recordId + ' from scaper_db.emails');
      res.redirect(req.headers.referer);
    }
  });
});
// ----------------- END /emails/delete/<%= emailItem._id %> PRODUCTION CODE  ------------------//















// ###################################################### routes #####################################################
// ###################################################### routes #####################################################
// #####################################################  routes #####################################################

// BASE ROUTE
app.get("/", function (req, res) {
  fs.readFile('.env.json',function(err, dataJson){
    if (err){
      console.log("no token file")
    }
    else{
      data = JSON.parse(dataJson)
      var selectData = []
      for(i=0;i<data.length; i++){
        try{
          d = data[i]
          email = d['email']
          selectData.push(email)
        }
        catch{
          continue;
        }
      }

      // console.log("SELECT DATA ",selectData)

      if (selectData != null){
        res.render("home", {
          pageTitle: 'Home',
          tokenData: selectData
        });
      }
      else{
        res.render("home", {
          pageTitle: 'Home',
          tokenData: []
        });
      }
  }
});
});




app.get("/re", function (req, res) {
  const fs = require('fs');
  const readline = require('readline');
  const {google} = require('googleapis');
  const SCOPE1 = ['https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/userinfo.email'];

  const TOKEN_PATH = '.env.json';
  const open = require('open');

  function authorize(credentials) {
    const {client_secret, client_id, redirect_uris} = credentials.installed;
    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
    getNewToken(oAuth2Client);
  }
  
  function getNewToken(oAuth2Client) {
    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPE1,
    });
    open(authUrl, "_self");
  }

    fs.readFile('.credentials.json', (err, content) => {
      if (err) return console.log('Error loading client secret file:', err);
      authorize(JSON.parse(content));
    });
    res.redirect('/');
});




app.get("/gmail", function (req, res) {
  console.log("RESPONSE CODE RESPONSE CODE RESPONSE CODE RESPONSE CODE RESPONSE CODE", req)
  res.render("gmail", {
    pageTitle: 'gmail',
    token: req.query.code,
  });
});




app.post("/confirm", function (req, res) {
  function process(values){
    const {client_secret, client_id, redirect_uris} = values.installed;
    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
    return oAuth2Client;
  }

  function listLabels(auth, token) {
    const gmail = google.gmail({version: 'v1', auth});
    gmail.users.getProfile({
      userId:'me',
    }, (err, res) =>{
      if (err) {
        console.log("ERR IN GETTING USER PROFILE", err)
      }
      else{
        var email = res.data.emailAddress;
        // Store the token to disk for later program executions
        fs.readFile('.env.json', function (err, data) {
          if (err) return console.error('*********888888888888**********', err);
          var flag = false;
          var json = JSON.parse(data)
          console.log("JSON, ",json);
          console.log("JSON LENGTH, ",json.length);


          for (i=0;i<json.length; i++){
            try{
              im = json[i]
              console.log("IM: ", im)
              iemail = im['email']
              console.log("IEMAIL", iemail)
              if (email == iemail){
                flag = true;
                console.log("Matched ", email, iemail);
                break;
              }
            }
            catch{
              continue;
            }
          }
          if(flag == true){
            console.log("Do nothing")
          }
          else{
            token['email'] = email;
            var output = json.concat(token);
            var sout = JSON.stringify(output)
            fs.writeFile(".env.json", sout, function (err) {
              if (err) return console.log(err);
            });
          }
        })
      }
    });
  }

  
  

function validate(code, oAuth2Client, callback){
  oAuth2Client.getToken(code, (err, token) => {
    if (err) return console.error('Error retrieving access token ((((((((((((((((((((((********888888888888*******', err);

    oAuth2Client.setCredentials(token);
    callback(oAuth2Client, token);
  });
 }

 fs.readFile('.credentials.json', (err, content) => {
  if (err) return console.log('Error loading secret file:', err);
  var values = JSON.parse(content);
  oAuth2Client = process(values)
  var code = req.body.to_email;
  validate(code, oAuth2Client, listLabels);
});

res.redirect('/');
});



// ############################ remove the selected item form token ########################
app.post("/remove/:removeId", function (req, res) {
  const removeId = req.params.removeId;
  console.log('REMOVE ID IS - ' + removeId);

  fs.readFile('.env.json', function (err, data) {
    if (err) return console.error(err);
    var json = JSON.parse(data)

    for (i=0;i<json.length; i++){
      try{

        im = json[i]
        iemail = im['email']
        if (removeId == iemail){
          console.log("Matched ", removeId, iemail, i);
          delete json[i]
          break;
        }
      }
      catch{
        continue;
      }
    }

      var sout = JSON.stringify(json)
      fs.writeFile(".env.json", sout, function (err) {
        if (err) return console.log(err);
      });
    }
  )

  res.redirect('/')
}
)

























// ----------------- BEGIN OF SENDEMAIL CODE  ------------------//
// ----------------- BEGIN OF SENDEMAIL CODE  ------------------//
// ----------------- BEGIN OF SENDEMAIL CODE  ------------------//
require("dotenv-json")();
app.post("/sendmail", function (req, res) {
  var from_email = req.body.from_email;

  // for stesting purpose
  fs.readFile('.env.json', function (err, data) {
    if (err) return console.error(err);
    var json = JSON.parse(data)
    var target;
    for (i=0;i<json.length; i++){
      try{
        im = json[i]
        iemail = im['email']
        if (from_email == iemail){
          console.log("Matched ", from_email, iemail, i);
           target = json[i]
        }
      }
      catch{
        continue;
      }
    }

    const transporter = nodemailer.createTransport({
      pool: true,
      service: 'Gmail',
      auth: {
        type: 'OAuth2',
        user: process.env.GMAIL_AUTH_USER,
        clientId: process.env.GMAIL_AUTH_CLIENT_ID,
        clientSecret: process.env.GMAIL_AUTH_CLIENT_SECRET,
        refreshToken: process.env.GMAIL_AUTH_REFRESH_TOKEN,
        accessUrl: process.env.GMAIL_AUTH_ACCESS_URL
      }
    });
    
    transporter.verify((error, success) => {
      if (error) return console.log(error)
      console.log('Server is ready to send email:', success);
      transporter.on('token', token => {
        console.log('A new access token was generated');
        console.log('User: %s', token.user);
        console.log('Access Token: %s', token.accessToken);
        console.log('Expires: %s', new Date(token.expires));
      });
    });

          
    // ###################  SENDING SECITON ###########################
      var names = from_email.split('@');
      var name = names[0]

      console.log("FROM EMAIL IS ",from_email);
      console.log("FROM EMAIL name is  ",name);
      
      if (req.body.to_email) {
          let emails = req.body.to_email.split(',');
          emails.forEach(function (email) {
          let tmp_emails = email.split(',');
          let email_data = tmp_emails[0].split('@');
          let tmp_email_subject = req.body.email_subject.replace('[domain of prospect]', email_data[1]);
          let tmp_email_body = req.body.email_body.replace('[domain of prospect]', email_data[1]);
          let mailDetails = {
                // from: 'Amit Ranjan Nath <nath.r.amit@gmail.com>',
                from: name+ '<'+from_email+'>', 
                to: email,
                subject: tmp_email_subject,
                text: tmp_email_body
              };
        
              transporter.sendMail(mailDetails, function (err, data) {
                if (err) {
                  console.log('Error Occurs');
                  console.log(err);
                } else {
                  console.log('Email sent successfully');
                  console.log(data);
                }
              });
            });

            res.redirect(req.headers.referer);
          } else {
            let report_title = req.body.category;
            console.log('report_title - ' + report_title);
        
            let email_subject = req.body.email_subject;
            console.log('email_subject - ' + email_subject);
        
            let email_body = req.body.email_body;
            console.log('email_body - ' + email_body);
        
            Email.find({
              'report_title': report_title
            }, {
              _id: 0,
              email: 1
            }, function (error, emails) {
              if (error) {
                console.log(error);
              } else {
                console.log(emails);
                console.log(emails.length);
                if (emails.length === 0) {
                  Email.find({
                    'category': report_title
                  }, {
                    _id: 0,
                    email: 1
                  }, function (err, emls) {
                    if (err) {
                      console.log(err);
                    } else {
                      emls.forEach(function (eml) {
                        let tmp_emails = eml.email.split(',');
                        let email_data = tmp_emails[0].split('@');
                        let tmp_email_subject = email_subject.replace('[domain of prospect]', email_data[1]);
                        let tmp_email_body = email_body.replace('[domain of prospect]', email_data[1]);
                        let mailDetails = {
                          // from: 'Amit Ranjan Nath <nath.r.amit@gmail.com>',
                          from: name+ '<'+from_email+'>', 
                          to: email.email,
                          subject: tmp_email_subject,
                          text: tmp_email_body
                        };
        
                        transporter.sendMail(mailDetails, function (err, data) {
                          if (err) {
                            console.log('Error Occurs');
                            console.log(err);
                          } else {
                            console.log('Email sent successfully');
                            console.log(data);
                          }
                        });
                      });
                      res.redirect('/reports');
                    }
                  });
                } else {
                  emails.forEach(function (email) {
                    let tmp_emails = email.email.split(',');
                    let email_data = tmp_emails[0].split('@');
                    let tmp_email_subject = email_subject.replace('[domain of prospect]', email_data[1]);
                    let tmp_email_body = email_body.replace('[domain of prospect]', email_data[1]);
                    let mailDetails = {
                      // from: 'Amit Ranjan Nath <nath.r.amit@gmail.com>',
                      from:name+ '<'+from_email+'>',  
                      // 'nayeem <santhej@outsourceman.com>',
                      to: email.email,
                      subject: tmp_email_subject,
                      text: tmp_email_body
                    };
        
                    transporter.sendMail(mailDetails, function (err, data) {
                      if (err) {
                        console.log('Error Occurs');
                        console.log(err);
                      } else {
                        console.log('Email sent successfully');
                        console.log(data);
                      }
                    });
                  });
                  res.redirect('/view');
                }
              }
            });
          }
        });         
  });

    

    // fs.readFile('.credentials.json', function (err, dataa) {
    //   if (err) return console.error(err);
    //   var cred = JSON.parse(dataa)

    // console.log("ALLL VALUE ARE HERE :")
    // console.log(target.email)
    // console.log(cred.installed.client_id)
    // console.log(cred.installed.client_secret)
    // console.log(target.access_token)
    // console.log(cred.installed.token_uri)


    // console.log("ALLL VALUE ARE HERE :")
    // console.log()
    // console.log()
    // console.log()

      //  console.log("HERE IS THE CRED ", cred.installed.auth_uri);

  
      // const transporter = nodemailer.createTransport({
      //   pool: true,
      //   service: 'Gmail',
      //   auth: {
      //     type: 'OAuth2',
      //     user: target.email,
      //     clientId: cred.installed.client_id,
      //     clientSecret: cred.installed.client_secret,
      //     refreshToken: target.access_token,
      //     accessUrl:  cred.installed.token_uri
      //   }
      // });

      // transporter.verify((error, success) => {
      //   if (error) return console.log(error)
      //   console.log('Server is ready to send email:', success);
      //   transporter.on('token', token => {
      //     console.log('A new access token was generated');
      //     console.log('User: %s', token.user);
      //     console.log('Access Token: %s', token.accessToken);
      //     console.log('Expires: %s', new Date(token.expires));
        // });
      // });
      //  console.log("HERE IS THE TARGET ", target.access_token);
    
 
      // console.log("ERROR IN CREDENTIALS ")
  


 
  






// ----------------- END OF SENDEMAIL CODE  ------------------//



































// ----------------- BEGIN ADD TEMPLATE CODE  ------------------//
app.post('/add-template', function (req, res) {
  console.log(req.body);

  Template.insertMany({
    template_name: req.body.template_name,
    template_subject: req.body.template_subject,
    template_body: req.body.template_body
  }, function (err) {
    if (err) {
      console.log(err);
    } else {
      console.log('/add-template - Successfully inserted template into scaper_db.templates');
      res.redirect("/#add_template");
    }
  });
});

// ----------------- ENDOF ADD TEMPLATE CODE  ------------------//

// ----------------- BEGIN /templates PRODUCTION CODE  ------------------//
// ----- For displaying reports based on keyword combos- -----//
app.get("/templates", function (req, res) {
  Template.find({}, function (err, templates) {
    if (err) {
      console.log(err);
    } else {
      console.log('/templates - Successfully retrieved all templates from scaper_db.templates');
      console.log(templates);
      res.render("templates", {
        pageTitle: 'Predefined Email Templates',
        templates: templates
      });
    }
  });
});

app.post("/templates/:templateId", function (req, res) {
  const templateId = req.params.templateId;
  console.log('Template Id - ' + templateId);
  Template.deleteOne({
    '_id': templateId
  }, function (error) {
    if (error) {
      console.log(error);
    } else {
      console.log('/templates/:templateId - Successfully deleted template from scaper_db.emails');
      res.redirect("/templates");
    }
  });
});
// ----------------- END /templates PRODUCTION CODE  ------------------//

// ----------------- BEGIN /updateReportTitle PRODUCTION CODE  ------------------//
app.post("/updateReportTitle", function (req, res) {
  console.log(req.body);
  Url.updateMany({
      'category': req.body.previousTitle
    }, {
      $set: {
        "category": req.body.newTitle
      }
    },
    function (err, result) {
      if (err) {
        console.log(err);
      } else {
        console.log('Updated category of ' + result.nModified + ' document(s)');
        res.redirect(req.headers.referer)
      }
    }
  );
});
// ----------------- END /updateReportTitle PRODUCTION CODE  ------------------//

// ----------------- BEGIN /updateKeywordsTitle PRODUCTION CODE  ------------------//
app.post("/updateKeywordsTitle", function (req, res) {
  console.log(req.body);
  Url.updateMany({
      'report_title': req.body.previousTitle
    }, {
      $set: {
        "report_title": req.body.newTitle
      }
    },
    function (err, result) {
      if (err) {
        console.log(err);
      } else {
        console.log('Updated report_title of ' + result.nModified + ' document(s)');
        res.redirect(req.headers.referer)
      }
    }
  );
});
// ----------------- END /updateKeywordsTitle PRODUCTION CODE  ------------------//

app.get('*', function (req, res) {
  res.status(404).render('404')
});



















// ----------------- END 404 PRODUCTION CODE  ------------------//

// app.get("/about", function(req, res) {
//   res.render("about");
// });

let port = process.env.PORT;
if (port == null || port == "") {
  port = 3000;
}
app.listen(port, function () {
  console.log("Server has started successfully on port - " + port);
});