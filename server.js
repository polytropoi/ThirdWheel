
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
const app = express();

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
      
      // console.log(`PaymentIntent for ${paymentIntent.amount} was successful!`);
    
        // try {
        //   // const coll = await database.collection('stripe_events');
        //   // const result = await coll.insertOne(event);
        //   await client.connect();

        //   database = client.db(dbName);
        //   let data = {};
        //   data.type = event.type;
        //   data.dateCreated = event.date;
        //   data.stripeEventID = event.id;

        //   result = await database.collection('stripe_events').insertOne(event);
        //   console.log("A document was inserted with the _id: " +result.insertedId);
        // } catch (error) {
        //   console.log (error);
        // } finally {
        //   // await client.close();
        // }

      break;
    case 'payment_method.attached':

        // try {
        //   await client.connect();
        //   database = client.db(dbName);
        //   result = await database.collection('stripe_events').insertOne(event);
        //   console.log("A document was inserted with the _id: " +result.insertedId);
        // } catch (error) {
        //   console.log (error);
        // } finally {
        //   // await client.close();
        // }


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
        } catch (error) {
          console.log (error);
        } finally {
          await client.close();
        }

      break;
      case 'payment_intent.created':

      // Then define and call a method to handle the successful attachment of a PaymentMethod.
      // handlePaymentMethodAttached(paymentMethod);
        // try {
        //   // const coll = await database.collection('stripe_events');
        //   // const result = await coll.insertOne(event);
        //   await client.connect();
        //   database = client.db(dbName);
        //   result = await database.collection('stripe_events').insertOne(event);
        //   console.log("A document was inserted with the _id: " +result.insertedId);
        // } catch (error) {
        //   console.log (error);
        // } finally {
        //   // await client.close();
        // }

      break;    
    // default:
    //   // Unexpected event type
    //   console.log(`Unhandled event type ${event.type}.`);

    //     try {
    //       // const coll = await database.collection('stripe_events');
    //       // const result = await coll.insertOne(event);
          
    //       await client.connect();
    //       database = client.db(dbName);
    //       result = await database.collection('stripe_events').insertOne(event);
    //       console.log("A document was inserted with the _id: " +result.insertedId);
    //     } catch (error) {
    //       console.log (error);
    //     } finally {
    //       await client.close();
    //     }
    //     break;
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
    res.send("<div><pre>" + JSON.stringify(result, undefined, 2) +"</pre></div>");
  } catch (error) {
    console.log (error);
  }
})

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
    metadata: {
      product_id: 1000,
      product_name: "super cool immersive rock show!"
    },
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