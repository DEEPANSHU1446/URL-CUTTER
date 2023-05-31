const urlModel = require("../models/urlModel");
const shortId = require("shortid");
const axios = require("axios");
const redis = require("redis");

//Connect to redis
const redisClient = redis.createClient({
  url: "redis://default:JC5RwQkdKFBnVdL4bA7yMxO6I1D9y7ri@redis-12874.c305.ap-south-1-1.ec2.cloud.redislabs.com:12874",
});
redisClient.connect();
redisClient.on("connect", async function () {
  console.log("Connected to Redis..");
});


const createShortURL = async function (req, res) {
  try {
   
    let { longUrl } = req.body;
    longUrl = longUrl.trim();

    let baseUrl = "http://localhost:3000";

    if (!longUrl)
      return res
        .status(400)
        .send({ status: false, message: "long URL is mandatory" });

    req.body.urlCode = shortId.generate().toLowerCase();
    req.body.shortUrl = baseUrl + "/" + req.body.urlCode;

    let cachedURLCode = await redisClient.get(longUrl);
    if (cachedURLCode) {
      return res.status(200).send({
        status: true,
        message: "Already URL shorten from redis ",
        data: JSON.parse(cachedURLCode),
      });
    }

    let findURL = await urlModel
      .findOne({ longUrl: longUrl })
      .select({ _id: 0, __v: 0, createdAt: 0, updatedAt: 0 });

    if (findURL) {
      await redisClient.set(longUrl, JSON.stringify(findURL), "EX", 10);
        return res
        .status(200)
        .send({
          status: true,
          message: " I am coming from db already shortend ",
          data: findURL,
        });
    }

    let urlFound;
    let obj = {
      method: "get",
      url: longUrl,
    };
    await axios(obj)
      .then(() => (urlFound = true))
      .catch(() => {
        urlFound = false;
      });
    if (!urlFound) {
      return res
        .status(400)
        .send({ status: false, message: "Please provide valid LongUrl axios" });
    }

    let url = await urlModel.create(req.body);

    let createURL = {
      longUrl: url.longUrl,
      shortUrl: url.shortUrl,
      urlCode: url.urlCode,
    };

    await redisClient.set(longUrl, JSON.stringify(createURL), "EX", 10);
    return res.status(201).send({
      status: true,
      message: "successfully shortend",
      data: createURL,
    });
  } catch (error) {
    return res.status(500).send({ status: false, message: error.message });
  }
};

const redirectURL = async function (req, res) {
  try {
    let urlCode = req.params.urlCode;

    let cachedURLCode = await redisClient.get(urlCode);
    if (cachedURLCode) {
      return res.status(302).redirect((cachedURLCode));
    }

    let findUrlCode = await urlModel.findOne({ urlCode: urlCode });

    await redisClient.set(urlCode,(findUrlCode.longUrl));

    if (!findUrlCode)
      return res
        .status(404)
        .send({ status: false, message: "urlCode does not exist" });

    return res.status(302).redirect(findUrlCode.longUrl);
  } catch (error) {
    return res.status(500).send({ status: false, message: error.message });
  }
};

module.exports = { createShortURL, redirectURL };
