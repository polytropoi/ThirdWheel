
require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_KEY);
const endpointSecret = process.env.STRIPE_TEST_ENDPOINT_SECRET;
const rootDomain = process.env.ROOT_DOMAIN;

const { MongoClient } = require('mongodb');
const url = process.env.MONGO_URL;
const client = new MongoClient(url);

const root = process.env.MODE != 'dev' ? 'https://' + process.env.ROOT_DOMAIN : 'http://localhost:' + process.env.PORT;
// Database Name
const dbName = 'rrdata1';
let db;

async function main() {
  // Use connect method to connect to the server
  await client.connect();
  db = client.db(dbName); 
  return 'connected to db! ';
}
main()
  .then(console.log)
  .catch(console.error);
  // .finally(console.log("connected to db!"));

const express = require('express');
const app = express();

// app.use(express.static('public'));
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
      console.log(JSON.stringify(event));
    } catch (err) {
      console.log(`Webhook signature verification failed.`, err.message);
      return response.sendStatus(400);
    }
  }
  console.log("tryna handle event type " + JSON.stringify(event.type));
  // Handle the event
  switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object;
      console.log(`PaymentIntent for ${paymentIntent.amount} was successful!`);
      // Then define and call a method to handle the successful payment intent.
      // handlePaymentIntentSucceeded(paymentIntent);
        try {
          const coll = db.collection("stripe_events");
          const result = await coll.insertOne(event);
          console.log("A document was inserted with the _id: " +result.insertedId);
        } catch (error) {
          console.log (error);
        }

      break;
    case 'payment_method.attached':
      const paymentMethod = event.data.object;
      // Then define and call a method to handle the successful attachment of a PaymentMethod.
      // handlePaymentMethodAttached(paymentMethod);
        try {
          const coll = db.collection("stripe_events");
          const result = await coll.insertOne(event);
          console.log("A document was inserted with the _id: " +result.insertedId);
        } catch (error) {
          console.log (error);
        }

      break;
    default:
      // Unexpected event type
      console.log(`Unhandled event type ${event.type}.`);

        try {
          const coll = db.collection("stripe_events");
          const result = await coll.insertOne(event);
          console.log("A document was inserted with the _id: " +result.insertedId);
        } catch (error) {
          console.log (error);
        }
  }

  // Return a 200 response to acknowledge receipt of the event
  response.send();
});


app.post('/create-checkout-session', async (req, res) => {
  const session = await stripe.checkout.sessions.create({
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'T-shirt',
          },
          unit_amount: 2000,
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    success_url: root +'/static/success.html',
    cancel_url: root +'/static/cancel.html',
  });

  res.redirect(303, session.url);
});

app.get('/', (req, res) => {
  res.send("<html><head><title>Regal Rooms</title></head><body>"+
  "<h1>Welcome to<br>Regal Rooms<br>Immersive Network</h1><br><br>"+
    "<form action=\x22../create-checkout-session\x22 method=\x22POST\x22>"+
      "<button type=\x22submit\x22>Checkout</button>"+
    "</form></body></html>");
  // "<div><a href=\x22/static/checkout.html\x22>checkout</a></div>");
});

app.listen(process.env.PORT, () => console.log('Running on port ' + process.env.PORT));