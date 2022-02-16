const cron = require('node-cron');

const {
    awsConfigure,
    mongoDump,
    uploadTree,
    rimraf,
    clearOldS3,
} = require('./functions');

/**
 * 
 * @returns {Promise<string>}
 */
async function main() {

    awsConfigure();

    // -------------------------------------------

    console.log('-------- start dump --------');
    await mongoDump();
    console.log('-------- dump done --------');

    // -------------------------------------------

    console.log('-------- start upload --------');
    const date = new Date();
    const folder = [
        date.getFullYear(),
        date.getMonth() + 1,
        date.getDate(),
        date.getHours(),
        date.getMinutes()
    ].join('-');
    await uploadTree(['dump'], folder);
    console.log('-------- upload done --------');

    // -------------------------------------------

    console.log('-------- start clear --------');
    await rimraf(['dump']);
    console.log('-------- clear done --------');

    // -------------------------------------------

    console.log('-------- start clear old backup --------');
    await clearOldS3();
    console.log('-------- clear old backup done --------');

    // -------------------------------------------

    return 'done';
}


cron.schedule('0 0 0 * * *', () => {
    main()
        .then(() => console.log('-------- done --------'))
        .catch((err) => console.log(err));
});

