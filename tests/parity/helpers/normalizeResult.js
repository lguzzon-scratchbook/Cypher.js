function sortPlainObject(value) {
    if (Array.isArray(value)) {
        return value.map(sortPlainObject);
    }

    if (!value || typeof value !== 'object') {
        return value;
    }

    return Object.keys(value)
        .sort()
        .reduce((acc, key) => {
            acc[key] = sortPlainObject(value[key]);
            return acc;
        }, {});
}

function normalizeExecution(execution) {
    if (!execution.ok) {
        return {
            ok: false,
            error: execution.error
        };
    }

    return {
        ok: true,
        result: sortPlainObject(execution.result)
    };
}

module.exports = {
    normalizeExecution
};