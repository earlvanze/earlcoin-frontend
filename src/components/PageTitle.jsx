import React from 'react';
    import { Helmet } from 'react-helmet';
    import { motion } from 'framer-motion';

    const PageTitle = ({ title, description }) => {
      return (
        <>
          <Helmet>
            <title>{`${title} | EarlCoin DAO`}</title>
            <meta name="description" content={description} />
          </Helmet>
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-8"
          >
            <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">{title}</h1>
            {description && <p className="text-lg text-muted-foreground mt-2">{description}</p>}
          </motion.div>
        </>
      );
    };

    export default PageTitle;