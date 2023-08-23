
require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_KEY);
const endpointSecret = process.env.STRIPE_ENDPOINT_SECRET;
const rootDomain = process.env.ROOT_DOMAIN;
// const mongodb = require('mongodb');
const { MongoClient } = require('mongodb');
const url = process.env.MONGO_URL;
// const client = new MongoClient(url);

const root = process.env.MODE != 'dev' ? 'https://' + process.env.ROOT_DOMAIN : 'http://localhost:' + process.env.PORT;
// Database Name
const dbName = 'rrdata1';
// let database = null;

let status = "db not connected...";
const uri = "<connection string uri>";
const client = new MongoClient(url);


async function run() {
  try {
    await client.connect();

    // Establish and verify connection
    await client.db("admin").command({ ping: 1 });
    console.log("Connected successfully to mongo!");
    status = "connected!";
  } finally {
    // Ensures that the client will close when you finish/error
    await client.close();
  }
}
run().catch(console.dir);

const express = require('express');
var bodyParser = require('body-parser');
const app = express();
app.use(bodyParser.json({ "limit": "10mb", extended: true }));
app.use(bodyParser.urlencoded({ extended: false }));
app.use('/static', express.static('public'));

app.post('/stripe_webhooks', express.raw({type: 'application/json'}), async (request, response) => {
  // let event = request.body;
  let event;
  // Only verify the event if you have an endpoint secret defined.
  // Otherwise use the basic event deserialized with JSON.parse
  if (endpointSecret) {
    // Get the signature sent by Stripe
    const signature = request.headers['stripe-signature'];
    try {
      event = stripe.webhooks.constructEvent(
        // request.body,
        request.body,
        signature,
        endpointSecret
      );
      // console.log(JSON.stringify(event));
    } catch (err) {
      console.log(`Webhook signature verification failed.`, err.message);
      return response.sendStatus(400);
    }
  }
  // console.log("tryna handle event type " + JSON.stringify(event.type));
  // Handle the event
  // const paymentIntent = event.data.object;
  switch (event.type) {
    
    case 'payment_intent.succeeded':
      //do things etc..

      break;
    case 'payment_method.attached':
        //do things etc..
      break;
    case 'charge.succeeded':

      // Then define and call a method to handle the successful attachment of a PaymentMethod.
      // handlePaymentMethodAttached(paymentMethod);
        try {
          await client.connect();
          database = client.db(dbName);
          let data = {};
          data.livemode = event.livemode;
          data.type = event.type;
          data.dateCreated = event.created;
          data.stripeEventID = event.id;
          data.amount = event.data.object.amount;
          data.description = event.data.object.description;
          data.customer = event.data.object.customer;
          data.email = event.data.object.billing_details.email;
          data.name = event.data.object.billing_details.name;
          data.phone = event.data.object.billing_details.phone;
          data.receipt_email = event.data.object.receipt_email;
          data.receipt_url = event.data.object.receipt_url;
          data.product_id = event.data.object.metadata.product_id;
          data.product_name = event.data.object.metadata.product_name;
          // data.metadata = event.data.object.metadata;
          let result = await database.collection('stripeEvents').insertOne(data);
          console.log("A document was inserted with the _id: " +result.insertedId);
          let userResult = await database.collection('people').findOne({'email' : data.email});
          if (userResult) {
            console.log("already have that user!");
          } else {
            let newUserResult = await database.collection('people').insertOne(data);
            if (newUserResult) {
              console.log("made a new user for " + data.email);
            } 
          }
        } catch (error) {
          console.log (error);
        } finally {
          await client.close();
        }

      break;
      case 'payment_intent.created':

      break;    

  }

  // Return a 200 response to acknowledge receipt of the event
  response.send();
});
app.get('/stripe_events', async (req, res) => {
  
  try {
    // const coll = await database.collection('stripe_events');
    // const result = await coll.insertOne(event);
    await client.connect();
    database = client.db("rrdata1");
    result = await database.collection("stripeEvents").find().toArray();
    // console.log(JSON.stringify(result));
    // let userResult = await database.collection('people').findOne({'email' : data.email});
    for (const stripeevent of result) {
      if (stripeevent.email != null && stripeevent.email.length > 4) {
        const person = await database.collection("people").findOneAndUpdate(
          { email: stripeevent.email },
          { $setOnInsert: { email: stripeevent.email, name: stripeevent.name, phone: stripeevent.phone } }, 
          { upsert: true, returnOriginal: false }
        );
      console.log(person.email + " uuppdated");
      } else {
        console.log("no email on that one!");
      }

    }

    // if (userResult) {
    //   console.log("already have that user!");
    // } else {
    //   let newUserResult = await database.collection('people').insertOne(data);
    //   if (newUserResult) {
    //     console.log("made a new user for " + data.email);
    //   } 
    // }
    res.send("<div><pre>" + JSON.stringify(result, undefined, 2) +"</pre></div>");
  } catch (error) {
    console.log (error);
  }
});

app.get('/people', async (req, res) => {
  
  try {
    // const coll = await database.collection('stripe_events');
    // const result = await coll.insertOne(event);
    await client.connect();
    database = client.db("rrdata1");
    result = await database.collection("people").find().toArray();
    // console.log(JSON.stringify(result));

    res.json(result);
  } catch (error) {
    console.log (error);
  }
});

app.post('/ext_auth_response', async (req, res) => {  
  try {

    console.log("tryna get ext auth! " + req.body.email + "-");
    await client.connect();
    database = client.db("rrdata1");
    // const query = {email: req.body.email};
    const emailResult = await database.collection("people").findOne({email: req.body.email});

    res.json(emailResult);
  } catch (error) {
    console.log (error);
    res.send(error);
    client.close();
  }
});

app.post('/create-checkout-session', async (req, res) => {
  const session = await stripe.checkout.sessions.create({

    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'super cool immersive rock show',
          },
          unit_amount: 2000,
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    success_url: root +'/stripe_events',
    cancel_url: root +'/static/cancel.html',
    payment_intent_data: {
      metadata: {
        product_id: '1000',
        product_name: 'super cool immersive rock show!'
      }
    }
  });

  res.redirect(303, session.url);
});

app.get('/', (req, res) => {
  res.send("<html><head><title>Regal Rooms</title></head><body>"+
  "<h1>Welcome to<br>Regal Rooms<br>Immersive Network</h1><br><span>"+status+"</span><br>"+
    "<form action=\x22../create-checkout-session\x22 method=\x22POST\x22>"+
      "<button type=\x22submit\x22>Checkout</button>"+
    "</form></body></html>");
  // "<div><a href=\x22/static/checkout.html\x22>checkout</a></div>");
});

app.listen(process.env.PORT, () => console.log('Running on port ' + process.env.PORT));