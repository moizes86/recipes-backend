
class LoginValidationError extends Error {
    constructor(message) {
        super(message);
        this._data = null;
    }

    set data(value) {
        this._data = value;
    }
    get data() {
        return this._data;
    }
}

module.exports = {
    LoginValidationError
}