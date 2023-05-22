import { getGameByID } from '~/server/pkg/game'
import { ReversiBoard } from '~/server/model/reversiBoard'
import { DiscRole } from '~/server/model/disc_role'
import admin from '~/server/firebase-admin'

const db = admin.firestore()

export interface PlaceRequest {
  gameID: string
  index: number
}

export default defineEventHandler(async (event) => {
  const userID = event.context.userID
  if (!userID) {
    return createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  }

  const req = await readBody(event)
    .then((body) => {
      return body as PlaceRequest
    })
    .catch(() => {
      return null
    })
  if (!req || !req.gameID || !req.index) {
    return createError({
      statusCode: 400,
      statusMessage: 'Bad Request'
    })
  }

  const game = await getGameByID(req.gameID)
  if (!game) {
    return createError({
      statusCode: 404,
      statusMessage: 'Not Found'
    })
  }

  if (
    game.users[0] !== userID &&
    game.users.length === 2 &&
    game.users[1] !== userID
  ) {
    return createError({
      statusCode: 403,
      statusMessage: 'Forbidden'
    })
  }

  if (game.end) {
    return createError({
      statusCode: 404,
      statusMessage: 'No Active Game Found, Game is over'
    })
  }

  const nextUserTurn =
    game.turn === DiscRole.BLACK ? game.black_user : game.white_user
  if (nextUserTurn !== userID) {
    return createError({
      statusCode: 403,
      statusMessage: 'Forbidden, not your turn...'
    })
  }

  const board = new ReversiBoard(game)
  const newGame = board.placeDisc(req.index)
  if (!newGame) {
    return createError({
      statusCode: 400,
      statusMessage: 'Bad Request'
    })
  }

  await db.collection('games').doc(req.gameID).update({
    board: newGame.board,
    turn: newGame.turn,
    black_num: newGame.black_num,
    white_num: newGame.white_num,
    possible_num: newGame.possible_num,
    end: newGame.end
  })

  if (game.end) {
    await db.runTransaction(async (transaction) => {
      transaction.update(db.collection('users').doc(game.black_user), {
        in_game: false,
        game_id: ''
      })
      transaction.update(db.collection('users').doc(game.white_user), {
        in_game: false,
        game_id: ''
      })
    })
  }
  return {
    statusCode: 200
  }
})
