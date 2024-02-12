"use strict";
module.exports = async function (fastify, opts) {
  fastify.register(require("@fastify/postgres"), {
    connectionString: "postgres://postgres:postgres@postgres:5432/postgres",
  });

  fastify.setSchemaErrorFormatter((errors, dataVar) => {
    const error = new Error("Falha na validação do esquema");
    error.statusCode = 422;
    error.validation = errors;
    return error;
  });

  fastify.post("/clientes/:id/transacoes", {
    schema: {
      body: {
        type: "object",
        required: ["valor", "tipo", "descricao"],
        properties: {
          valor: { type: "integer", minimum: 1 },
          tipo: { type: "string", enum: ["d", "c"] },
          descricao: { type: "string", maxLength: 10, minLength: 1},
        },
      },
    },
    handler: async (req, reply) => {
      const { id } = req.params;
      const { valor, tipo, descricao } = req.body;

      try {
        await fastify.pg.transact(async client => {
          await client.query(
            "INSERT INTO transacao (cliente_id, valor, tipo, descricao) VALUES ($1, $2, $3, $4) RETURNING *",
            [id, valor, tipo, descricao]
          )

          const { rows } = await client.query(
            "SELECT saldo, limite FROM cliente WHERE id = $1", [id]
          );

          return reply.code(200).send({
            limite: rows[0].limite,
            saldo: rows[0].saldo
          })
        })
      } catch (error) {
        if (error.message === "Saldo insuficiente") {
          return reply.code(422).send({ message: "Saldo insuficiente" });
        }

        return reply.code(404).send({ message: "Falha na requisição" });
      }
    }
  });

  fastify.get("/clientes/:id/extrato", async function (request, reply) {
    if (request.params.id > 5) {
      reply.code(404).send({
        message: "Cliente não encontrado",
      });
    }

    const { rows } = await fastify.pg.query(
      'SELECT c.saldo, c.limite, t.valor, t.tipo, t.descricao, t.realizada_em FROM cliente c LEFT JOIN ( SELECT valor, tipo, descricao, realizada_em, cliente_id FROM transacao WHERE cliente_id = $1 ORDER BY realizada_em DESC LIMIT 10 ) t ON c.id = t.cliente_id WHERE c.id = $1;',
      [request.params.id]
    );

    const transacoes = rows
      .filter(row => row.valor !== null)
      .map(row => ({
        valor: row.valor,
        tipo: row.tipo,
        descricao: row.descricao,
        realizada_em: row.realizada_em
      }));

    return reply.code(200).send({
        saldo: {
          total: rows[0].saldo,
          limite: rows[0].limite,
          data_extrato: new Date()
        },
        ultimas_transacoes: transacoes || []
    })
  });
};
