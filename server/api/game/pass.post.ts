import { getGameByID } from '~/server/pkg/game'
import { DiscRole } from '~/server/model/disc_role'
import admin from '~/server/firebase-admin'

export interface PassRequest {
  gameID: string
}

const db = admin.firestore()

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
      return JSON.parse(body) as PassRequest
    })
    .catch(() => {
      return null
    })
  if (!req || !req.gameID) {
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

  if (game.users.indexOf(userID) === -1) {
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

  if (game.possible_num > 0) {
    return createError({
      statusCode: 400,
      statusMessage: 'You can place a disc, you cannot pass'
    })
  }

  await db
    .collection('games')
    .doc(game.id)
    .update({
      turn: game.turn === DiscRole.BLACK ? DiscRole.WHITE : DiscRole.BLACK
    })

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: 'OK'
    })
  }
})