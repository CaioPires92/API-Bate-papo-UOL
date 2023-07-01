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

app.get('/', (req, res) => {
  res.send('Ola, mundo')
})

app.get('/mensagem', (req, res) => {
  db.collection('mensagem')
    .find()
    .toArray()
    .then(mensagem => {
      return res.send(mensagem)
    })
    .catch(err => {
      return res.status(500).send(err.message)
    })
})

app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`)
})
