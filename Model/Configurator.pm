package Model::Configurator;
use strict;
use warnings;

use KiokuDB;
use KiokuDB::Backend::DBI;

use Include::Environment qw(db db_scope);
use Search::GIN::Extract::Callback;

my @extractors;

# TODO:
sub _all_extractors {
    my ($obj, $extractor, @args) = @_;
}

sub _create_user_extractor {
    sub {
        my ($obj, $extractor, @args) = @_;
        if ($obj->isa("Model::User")) {
            return {
                    sid => $obj->sid(),
                    username => $obj->username()
                   };
        }
    }
}

sub connect_db {
    my $dir = KiokuDB->new(
        backend => KiokuDB::Backend::DBI->new({
            create => 1,
            dsn => 'dbi:SQLite:dbname=tmp/test.db',
            extract => Search::GIN::Extract::Callback->new(
                extract => _create_user_extractor()
            ),
        })
    );
    db($dir);
    db_scope($dir->new_scope());
}

1

__END__

=head1 NAME

Model::Configurator - соединение с базой данных

=head1 DESCRIPTION

Используемый фреймворк для работы с базой данных: L<KiokuDB>.
L<KiokuDB> позволяет сохранять в базе данных структуры данных
Perl. Перед отправкой в БД объект сериализуется, т.е. перводится
в представление пригодное для его сохранения в БД, и, что самое
главное пригодное для его последующей загрузки.
Для простых структур данных
есть сериализатор по умолчанию. Так же объекты созданные при
помощи L<Moose> могут быть сохранены без указания сериализатора.

Все объекты сохранятся в одной таблице с 2мя полями: id объекта
и, собственно, сериализованный объект. В данном подходе есть
недостаток: плохо(если вообще) работает поик. Для решения этой
проблемы есть 2 подхода:

=over

=item 1
Создавать дополнительные поля в таблице
(на данный момент созданы поля name и сид). Недостаткоя является то,
что для большинства объектов выделенные поля будут пустыми.

=item 2
Отдельно поддержить информация о объектах, хранящихся в БД. Такой подход
реализован в библиотеке, но
не задокументирован. Так что для его реализации прийдётся использовать
другой интерфейс к базе данных и вручную поддерживать эту информацию.

=back

=head1 METHODS

=head2 connect_db

Читает конфиг из config/db.yml и устанавливает соединение.

=cut
