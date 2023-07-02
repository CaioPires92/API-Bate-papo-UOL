import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { MongoClient, ObjectId } from 'mongodb'
import Joi from 'joi'
import dayjs from 'dayjs'

const app = express()
const port = 5000
dotenv.config()

app.use(cors())
app.use(express.json())

const mongoClient = new MongoClient(process.env.DATABASE_URL)
let db

mongoClient
  .connect()
  .then(() => (db = mongoClient.db()))
  .catch(err => console.log(err.message))

app.get('/messages', async (req, res) => {
  const user = req.headers.user
  const limit = req.query.limit ? parseInt(req.query.limit) : undefined

  // Verificar se o parâmetro limit é um número válido
  if (limit !== undefined && (isNaN(limit) || limit <= 0)) {
    return res
      .status(422)
      .send('O parâmetro limit deve ser um número válido e maior que zero.')
  }

  try {
    let query = {
      $or: [{ to: user }, { from: user }, { from: 'Todos' }]
    }

    let messagesQuery = db.collection('messages').find(query).sort({ _id: -1 })

    if (limit) {
      messagesQuery = messagesQuery.limit(limit)
    }

    const messages = await messagesQuery.toArray()
    res.send(messages)
  } catch (err) {
    res.status(500).send(err.message)
  }
})

app.get('/participants', (req, res) => {
  db.collection('participants')
    .find()
    .toArray()
    .then(participants => {
      res.send(participants)
    })
    .catch(err => {
      res.status(500).send(err.message)
    })
})

app.post('/participants', (req, res) => {
  const { name } = req.body

  const participantsSchema = Joi.object({
    name: Joi.string().required().min(1)
  })

  const validation = participantsSchema.validate(req.body, {
    abortEarly: false
  })

  if (validation.error) {
    const errors = validation.error.details.map(detail => detail.message)
    return res.status(422).send(errors)
  } else {
    db.collection('participants')
      .findOne({ name })
      .then(existingParticipant => {
        if (existingParticipant) {
          return res.sendStatus(409)
        } else {
          const participant = { name, lastStatus: Date.now() }
          db.collection('participants')
            .insertOne(participant)
            .then(() => {
              return res.sendStatus(201)
            })
            .catch(err => {
              res.status(500).send(err.message)
            })
        }
      })
      .catch(err => {
        res.sendStatus(500).send(err.message)
      })
  }
})

app.post('/messages', async (req, res) => {
  const { to, text, type } = req.body
  const from = req.headers.user

  const message = {
    from,
    to,
    text,
    type,
    time: dayjs().format('HH:mm:ss')
  }

  const messageSchema = Joi.object({
    to: Joi.string().required().min(1),
    text: Joi.string().required().min(1),
    type: Joi.string().valid('message', 'private_message').required()
  })

  const validation = messageSchema.validate(req.body, { abortEarly: false })

  if (validation.error) {
    const errors = validation.error.details.map(detail => detail.message)
    return res.status(422).send(errors)
  }

  try {
    const existingParticipant = await db
      .collection('participants')
      .findOne({ name: from })
    if (!existingParticipant) {
      return res.status(422).send('O participante não existe.')
    }

    await db.collection('messages').insertOne(message)
    return res.sendStatus(201)
  } catch (err) {
    return res.status(500).send(err.message)
  }
})

app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`)
})
