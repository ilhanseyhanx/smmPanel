function validate(schema, source = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      return res.status(400).json({
        error: 'Gönderilen bilgiler geçersiz.',
        details: result.error.issues.map(issue => ({ field: issue.path.join('.'), message: issue.message }))
      });
    }
    req[source] = result.data;
    next();
  };
}

module.exports = { validate };

