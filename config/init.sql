
CREATE TYPE tipoEnum as ENUM ('d', 'c');

CREATE TABLE cliente (
  id INTEGER PRIMARY KEY,
  saldo INTEGER NOT NULL,
  limite INTEGER NOT NULL
);
CREATE TABLE transacao (
  id SERIAL PRIMARY KEY,
  cliente_id INTEGER NOT NULL,
  valor INTEGER NOT NULL,
  tipo tipoEnum NOT NULL,
  descricao VARCHAR(10) NOT NULL,
  realizada_em TIMESTAMP NOT NULL DEFAULT NOW(),
  FOREIGN KEY(cliente_id) REFERENCES cliente(id)
);

INSERT INTO cliente (id, limite, saldo) VALUES (1, 100000, 0);
INSERT INTO cliente (id, limite, saldo) VALUES (2, 80000, 0);
INSERT INTO cliente (id, limite, saldo) VALUES (3, 1000000, 0);
INSERT INTO cliente (id, limite, saldo) VALUES (4, 10000000, 0);
INSERT INTO cliente (id, limite, saldo) VALUES (5, 500000, 0);

CREATE OR REPLACE FUNCTION updateClienteSaldoOnTransactionInsert() 
RETURNS trigger AS $$
BEGIN 
    -- Bloqueia a linha específica do cliente para atualização
    PERFORM * FROM cliente WHERE id = NEW.cliente_id FOR UPDATE;
    
    -- Verifica e atualiza o saldo para transações de débito
    IF NEW.tipo = 'd' THEN
        IF (SELECT saldo - NEW.valor < -limite FROM cliente WHERE id = NEW.cliente_id) THEN 
            RAISE EXCEPTION 'Saldo insuficiente';
        ELSE  
            UPDATE cliente SET saldo = saldo - NEW.valor WHERE id = NEW.cliente_id;
        END IF;
    END IF;
    
    -- Atualiza o saldo para transações de crédito
    IF NEW.tipo = 'c' THEN
        UPDATE cliente SET saldo = saldo + NEW.valor WHERE id = NEW.cliente_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER updateClienteSaldoOnTransactionInsert BEFORE
INSERT ON transacao FOR EACH ROW EXECUTE FUNCTION updateClienteSaldoOnTransactionInsert();