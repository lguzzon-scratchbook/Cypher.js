const LegacyCypher = require('../../../js/Cypher.js');
const CypherNG = require('../../../js/CypherNG');

function createEngine(Engine, options) {
    return new Engine(Object.assign({ runInWebWorker: false }, options));
}

function executeQuery(Engine, query, options) {
    return new Promise((resolve) => {
        const cypher = createEngine(Engine, options);
        cypher.execute(
            query,
            (result) => resolve({ ok: true, result }),
            (error) => resolve({ ok: false, error: String(error) })
        );
    });
}

async function runTwinQuery(query, options) {
    const [legacy, ng] = await Promise.all([
        executeQuery(LegacyCypher, query, options),
        executeQuery(CypherNG, query, options)
    ]);

    return { legacy, ng };
}

module.exports = {
    LegacyCypher,
    CypherNG,
    createEngine,
    executeQuery,
    runTwinQuery
};