const ldap = require('ldapjs');

const { Pool } = require('pg');
const pool = new Pool({
  host: "localhost",
  port: "5432",
  user: "xgames",
  password: "password",
  database: "keycloak"
});

const server = ldap.createServer();

server.use((req, res, next) => {
  next();
});

server.bind('cn=admin', (req, res, next) => {
  if (req.dn.toString() !== 'cn=admin' || req.credentials !== 'admin') {
    return next(new ldap.InvalidCredentialsError());
  }

  res.end();
  return next();
});

server.search('ou=people,dc=cisco,dc=com', (req, res, next) => {
  const split = req.filter.toString().split('(uid=');
  if (split.length < 2) {
    res.end();
    next();
    return;
  }
  const username = split.join('').split(')')[0];

  pool.query('SELECT * from user_entity where username = $1', [username], (err, result) => {
    const [user] = result.rows;
    const { id } = user;

    pool.query('select * from user_group_membership where user_id = $1', [id], (err, _result) => {
      const { group_id } = _result.rows[0];

      pool.query('select name, value from group_attribute where group_id = $1', [group_id], (err, __result) => {
        const response = {
          dn: req.dn.toString(),
          attributes: __result.rows.reduce((updated, row) => ({
            ...updated,
            [row.name]: row.value,
          }), {}),
        };
        res.send(response);
        res.end();
        return next();
      });
    });
  });
});

server.listen(1389, () => {
  console.log('LDAP server listening at %s', server.url);
});
