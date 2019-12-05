const router = require('express').Router();
const userRoute = require('./user.route');
const messageRoute = require('./message.route');
const chatRoute = require('./chat.route');

// swagger modules
const swaggerUi = require('swagger-ui-express');
const swaggerJSDoc = require('swagger-jsdoc');

// Extended: https://swagger.io/specification/#infoObject
const options = {
  swaggerDefinition: {
    info: {
      title: 'Simple REST API Server',
      description: 'A sample API',
      version: '1.0.1',
      license: {
        name: 'Apache 2.0',
        url: 'http://www.apache.org/licenses/LICENSE-2.0.html'
      }
    },
    basePath: '/'
  },
  apis: ['./api/routes/*.js', './api/models/*.js']
};

const swaggerSpec = swaggerJSDoc(options);

router.get('/', (req, res) => {
  res.send('<h2>Server works fine!</h2>');
});

router.get('/swagger.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

router.use('/api-docs', swaggerUi.serve);
router.get('/api-docs', swaggerUi.setup(swaggerSpec));

router
  .use(userRoute)
  .use(messageRoute)
  .use(chatRoute);

module.exports = router;
