"use strict";

module.exports = async function SERVER_DELIVER(props) {
  const { data, fastify } = props;
  const summary = {
    type: data?.type,
    from: data?.from,
    to: data?.to,
    hasPayload: Boolean(data?.payload),
  };
  console.log("[SERVER_DELIVER] TODO: implement remote delivery handler", summary);
  fastify?.log?.info?.(
    summary,
    "SERVER_DELIVER handler invoked - TODO implement delivery",
  );
};
