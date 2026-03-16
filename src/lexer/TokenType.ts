export enum TokenType {
  // Estruturais
  LBRACKET        = "LBRACKET",        // [
  RBRACKET        = "RBRACKET",        // ]
  LPAREN          = "LPAREN",          // (
  RPAREN          = "RPAREN",          // )
  LANGLE          = "LANGLE",          // <  (abertura de slot)
  RANGLE          = "RANGLE",          // >  (fechamento de slot / prefixo de chamada de componente)
  DOUBLE_RANGLE   = "DOUBLE_RANGLE",   // >> (prefixo de definição de componente)

  // Operadores
  DOUBLE_COLON    = "DOUBLE_COLON",    // ::
  PIPE_ARROW      = "PIPE_ARROW",      // |>
  HASH            = "HASH",            // #
  AT              = "AT",              // @
  DOLLAR          = "DOLLAR",          // $
  DOT             = "DOT",             // .
  COLON           = "COLON",           // :
  COMMA           = "COMMA",           // ,

  // Literais
  STRING          = "STRING",          // "..." — valor sem as aspas
  IDENT           = "IDENT",           // qualquer identificador

  // Palavras-chave
  KW_LOGIC        = "KW_LOGIC",        // @logic

  // Especial
  EOF             = "EOF",
}
