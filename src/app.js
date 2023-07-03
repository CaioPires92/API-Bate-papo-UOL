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

app.post('/participants', async (req, res) => {
  try {
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
    }

    const existingParticipant = await db
      .collection('participants')
      .findOne({ name })

    if (existingParticipant) {
      return res.sendStatus(409)
    }

    const participant = { name, lastStatus: Date.now() }
    await db.collection('participants').insertOne(participant)

    // Salvar mensagem de entrada
    const message = {
      from: name,
      to: 'Todos',
      text: 'entrou na sala...',
      type: 'status',
      time: dayjs().format('HH:mm:ss')
    }

    await db.collection('messages').insertOne(message)

    return res.sendStatus(201)
  } catch (err) {
    return res.status(500).send(err.message)
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

app.post('/status', async (req, res) => {
  const user = req.headers.user

  if (!user) {
    return res.status(404).send()
  }

  try {
    const participant = await db
      .collection('participants')
      .findOne({ name: user })

    if (!participant) {
      return res.status(404).send()
    }

    await db
      .collection('participants')
      .updateOne({ _id: participant._id }, { $set: { lastStatus: Date.now() } })

    return res.sendStatus(200).send()
  } catch (err) {
    return res.status(500).send(err.message)
  }
})

// Função para remover participantes inativos e salvar mensagem de saída
const removeInactiveParticipants = async () => {
  try {
    const threshold = Date.now() - 10000 // Tempo limite de inatividade (10 segundos atrás)
    const inactiveParticipants = await db
      .collection('participants')
      .find({ lastStatus: { $lt: threshold } })
      .toArray()

    // Remover participantes inativos
    await db
      .collection('participants')
      .deleteMany({ lastStatus: { $lt: threshold } })

    // Salvar mensagem de saída para cada participante removido
    inactiveParticipants.forEach(async participant => {
      const message = {
        from: participant.name,
        to: 'Todos',
        text: 'sai da sala...',
        type: 'status',
        time: dayjs().format('HH:mm:ss')
      }

      await db.collection('messages').insertOne(message)
    })
  } catch (err) {
    console.error('Erro ao remover participantes inativos:', err)
  }
}

// Executar a função de remoção a cada 15 segundos
setInterval(removeInactiveParticipants, 15000)

app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`)
})
