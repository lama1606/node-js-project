require('dotenv').config();

const connectDB = require('./config/database');
const app = require('./app');

connectDB()
    .then(() => {
        const port = process.env.PORT || 4000;
        app.listen(port, () => {
            console.log(`listening on port: ${port}`);
        });
    })
    .catch((err) => {
        console.error(err);
        process.exit(1);
    });
