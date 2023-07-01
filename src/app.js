import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { MongoClient } from 'mongodb'

const app = express()
const port = 5000
dotenv.config()

app.use(cors())
app.use(express.json())

const mongoClient = new MongoClient('mongodb://localhost:27017/batepapo')
let db

mongoClient
  .connect()
  .then(() => (db = mongoClient.db()))
  .catch(err => console.log(err.message))

app.get('/messages', (req, res) => {
  db.collection('messages')
    .find()
    .toArray()
    .then(messages => {
      res.send(messages)
    })
    .catch(err => {
      res.status(500).send(err.message)
    })
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

  const participant = { name }
  db.collection('participants')
    .insertOne(participant)
    .then(() => {
      return res.sendStatus(201)
    })
    .catch(err => {
      res.status(500).send(err.message)
    })
})

app.post('/messages', (req, res) => {
  const { to, text, type } = req.body

  const message = { to, text, type }
  db.collection('messages')
    .insertOne(message)
    .then(() => {
      return res.sendStatus(201)
    })
    .catch(err => {
      res.status(500).send(err.message)
    })
})

app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`)
})
