const { Client } = require("pg");

const client = new Client({
  host: "techmarketingdemos.platform-query.adobe.io",
  port: 80,
  database: "ajo-decisioning:all",
  user: "7ABB3E6A5A7491460A495D61@AdobeOrg",
  password: "eNqrVkrMSVeyUgoKNjI1U9JRqjAtBfIyc4vj8xINdbNTK3UTS3QN9ZJTi4CS2ZkpWCSBEpklJUCJxBKlWgC4CRff.eNplVGFv2jAQ_S_5nAQ7JMapNGlZgWlroYVROqZKkWMf1JDEke2U0mn_fQ6h07T5Q2K_u_M93z37pyeFd-XhEU0ITRGhwzjKiy0WGOMooCORBnFKUUAjkgSYRZgnomAsInl7jDzfs6cGXDzjHIzJrTpA7VBeSqhtft4aXnnOmsahrQHdY2lMEzwlERni6yxDFGVxmkwz8pGiEcFbAs7AER8JB2-LYQgu2lhmu1Q_nzzjcklVP3lXT96ztY25GgxkZYKa4ZAJVUCpdrIOuao6eHBxH7zgwXx_OM5WX59_PC7s3Wpa_ZAIbfafnm8fp4fZitu7zzO8WW3wfD9D89Xu7fYbOi33D3h-mBzn-8Xr3fhLvEDryd3qcJqNJ9H8bZktHpcvm2r9dZk9eb8cUWYcywudbsn6M0fTJCEZIjGmEb2ejNM0QpiM4o9Zx_jLuCubbbwr5HvbXee_vr_ZbBYP69tZshg_3Eyzxfrme5Yt4w_n0ZXkT-8STNJhhBOSp0DTUUTjYBgRCGIkSEApQwFnJI1xTIqiQJfeVUq68BEVbJtGQwc0BXPADMQ34HM1Wfu36uimzgKvjdRgclk7B0pi1I2OAVd9_4uwYjXbge-UoFrXe162xoIONTDxDprLSghpXUNY6fbbqn_X4V4V-bateYf9Z2y02gO3IO61Ei2316q28Gr_89OqBONfauufVSFV6ISoYSeN1ad3LmeDU6j0GVS9fEJ3XNCychpmZQ8bA44-a-2z0n8jAkr5Avp0xraqFKBNP9cdsVqErHRbtMJdCA59jfQ5G3f5rYt1lVKt8KvG-K6WtRS-0rueXNNcKtZ9cgezWr6x7pSmhxr-_g8Zb_7MRcVyy7Rlte-u3IvkkDda1lw2rDThUUsL_uVSdKrriIDImf33IfB-_QY9llwB.eNoBAAH__ic7enpH5bG-w9dpIA8OrglP1klVeQS-WLikZ2BP1FtkND9ub4HqlYZMDBDr-dgJPuptPHAFIA4haPMlSoiKrI-Cu8mKwH15qseW-qXnelF-bCbFa1sxiZSVfSAFkYU9pg-lgwB1ZVlR3sr3aLun9cHBwvWmpyWsMgnTnmZvLqUSSHzm1Uy4VnmqLIABkcX6UXIUOcflC0vm7mn8Hl0QsFS249UbpBFFn_eRuOzsPI-HLtYKRnXgAGRjfSssGRervp8bALZptssWS7AWeNsG25yJepdK1Ib_K3h_tqREw4X5WrfQyHp6LK1pZ9qzRjraMvPa5FckHlJf_cCkeKKd4STUyn7C",
  ssl: {
    rejectUnauthorized: false
  }
});

async function main() {
  await client.connect();

  const result = await client.query(`
    SELECT
      _techmarketingdemos.formname,
      _techmarketingdemos.email
    FROM
      formsportalstatus_v2_20260731_172643_669
    WHERE
      _techmarketingdemos.submitted = FALSE
      AND _techmarketingdemos.savedat IS NOT NULL
  `);

  console.table(result.rows);

  await client.end();
}

main().catch(console.error);