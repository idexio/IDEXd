const { exec } = require('child_process');	

 module.exports = async () => {	
  await new Promise((resolve, reject) => {	
    const migrate = exec(	
      './node_modules/.bin/sequelize db:migrate',	
      { env: process.env },	
      (err) => {	
        if (err) {	
          reject(err);	
        } else {	
          resolve();	
        }	
      },	
    );	
    migrate.stdout.pipe(process.stdout);	
    migrate.stderr.pipe(process.stderr);	
  });	
};