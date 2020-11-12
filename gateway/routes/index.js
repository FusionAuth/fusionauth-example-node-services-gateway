const request = require('request');
const express = require('express');
const router = express.Router();
const {FusionAuthClient} = require('@fusionauth/typescript-client');
const clientId = 'YOUR CLIENT ID';
const clientSecret = 'YOUR CLIENT SECRET';
const client = new FusionAuthClient('noapikeyneeded', 'http://localhost:9011');
const checkAuthentication = require('../middleware/checkAuthentication');
const pkceChallenge = require('pkce-challenge');

/* GET home page. */
router.get('/', function (req, res, next) {
    const stateValue = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    req.session.stateValue = stateValue
    //generate the pkce challenge/verifier dict
    pkce_pair = pkceChallenge();
    // Store the PKCE verifier in session
    req.session.verifier = pkce_pair['code_verifier']
    const challenge = pkce_pair['code_challenge']
    res.render('index', {
        user: req.session.user,
        stateValue: stateValue,
        title: 'FusionAuth Example',
        challenge: challenge
    });
});

/* OAuth return from FusionAuth */
router.get('/oauth-redirect', function (req, res, next) {
    // This code stores the user in a server-side session
    const stateFromServer = req.query.state;
    if (stateFromServer !== req.session.stateValue) {
        console.log("State doesn't match. uh-oh.");
        console.log("Saw: " + stateFromServer + ", but expected: " + req.session.stateValue);
        res.redirect(302, '/');
        return;
    }
    client.exchangeOAuthCodeForAccessTokenUsingPKCE(req.query.code,
        clientId,
        clientSecret,
        'http://localhost:3000/oauth-redirect',
        req.session.verifier)
        .then((response) => {
            console.log(response.response.access_token);
            return client.retrieveUserUsingJWT(response.response.access_token);
        })
        .then((response) => {
            req.session.user = response.response.user;
        })
        .then((response) => {
            res.redirect(302, '/');
        }).catch((err) => {
        console.log("in error");
        console.error(JSON.stringify(err));
    });
});

/* PRODUCT CATALOG ROUTES */
const productUrl = 'http://localhost:3001';

router.get('/products', function (req, res, next) {
    request(`${productUrl}/products`).pipe(res);
});

router.get('/products/:id', function (req, res, next) {
    request(`${productUrl}/products/${req.params.id}`).pipe(res);
});

/* PRODUCT INVENTORY ROUTES */
router.get('/branches/:id/products', checkAuthentication, function (req, res, next) {
    const user = req.session.user;
    const options = {
        url: `http://localhost:3002/branches/${req.params.id}/products`,
        headers: {roles: user.registrations[0].roles}
    };
    request(options).pipe(res);
});

module.exports = router;
