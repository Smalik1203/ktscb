module.exports = function (api) {
  api.cache(true);
  const isProd = process.env.NODE_ENV === 'production';
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./'],
          alias: {
            '@': './',
          },
        },
      ],
      ...(isProd ? [['transform-remove-console', { exclude: [] }]] : []),
      'react-native-reanimated/plugin',
    ],
  };
};
