# Last Bite

Website prototype for Last Bite: stores in Nicosia post the food they have left at closing time, customers reserve it at a reduced price and collect it before the store closes.

## Pages

- `index.html` shows tonight's offers with filters and the reserve flow.
- `stores.html` explains the costs for a store, lets a store post an offer and check a pickup code.
- `pickups.html` lists your reservations with their pickup codes.

## Running it

Open `index.html` in a browser. There is no build step and no server. Bootstrap 5.3 and the fonts load from a CDN, so the page needs a connection the first time.

Offers posted on the store page and reservations are kept in the browser's local storage, so they stay on the device where they were made. Nothing is charged. The stores and offers in `js/data.js` are examples.

## Photos

The photos in `img/` come from Unsplash and are used under the Unsplash licence.
