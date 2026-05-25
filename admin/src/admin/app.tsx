import type { StrapiApp } from '@strapi/strapi/admin';

export default {
  config: {
    head: {
      title: 'SendLog Admin',
    },
    locales: [],
  },
  bootstrap(_app: StrapiApp) {},
};
