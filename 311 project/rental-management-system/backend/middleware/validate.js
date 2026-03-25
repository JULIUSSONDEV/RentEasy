const { validationResult } = require('express-validator');


function validate(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const messages = errors.array().map(e => e.msg);
        return res.status(422).json({ error: messages[0], errors: messages });
    }
    next();
}

module.exports = validate;
